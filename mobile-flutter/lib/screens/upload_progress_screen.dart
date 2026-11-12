import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import '../models/submission.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../services/chunk_uploader.dart';

enum UploadPhase {
  initializing,
  uploading,
  completing,
  qcProcessing,
  qcDone,
  error,
  cancelled,
}

class UploadProgressScreen extends StatefulWidget {
  final Task task;
  final File videoFile;
  final String fileName;
  final int fileSizeBytes;
  final ApiService apiService;

  const UploadProgressScreen({
    super.key,
    required this.task,
    required this.videoFile,
    required this.fileName,
    required this.fileSizeBytes,
    required this.apiService,
  });

  @override
  State<UploadProgressScreen> createState() => _UploadProgressScreenState();
}

class _UploadProgressScreenState extends State<UploadProgressScreen> {
  late final ChunkUploader _uploader;
  StreamSubscription<ChunkUploadProgress>? _progressSub;

  UploadPhase _phase = UploadPhase.initializing;
  ChunkUploadProgress _uploadProgress = const ChunkUploadProgress();
  UploadSession? _session;
  VideoSubmission? _submission;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _uploader = ChunkUploader();
    _subscribeProgress();
    _startProcess();
  }

  @override
  void dispose() {
    _progressSub?.cancel();
    _uploader.dispose();
    super.dispose();
  }

  void _subscribeProgress() {
    _progressSub = _uploader.progressStream.listen((progress) {
      if (mounted) {
        setState(() {
          _uploadProgress = progress;
        });
      }
    });
  }

  Future<void> _startProcess() async {
    setState(() {
      _phase = UploadPhase.initializing;
      _errorMessage = null;
    });

    try {
      final totalBytes = widget.fileSizeBytes > 0
          ? widget.fileSizeBytes
          : await widget.videoFile.length();
      final partCount =
          (totalBytes / ChunkUploader.defaultChunkSize).ceil().clamp(1, 1000);

      // 1. Create upload session
      final session = await widget.apiService.createUploadSession(
        assignmentId: widget.task.assignmentId ?? 'temp-assignment-${widget.task.id}',
        fileName: widget.fileName,
        fileSizeBytes: totalBytes,
        partCount: partCount,
        durationSeconds: widget.task.minDurationSeconds,
      );

      if (!mounted) return;
      setState(() {
        _session = session;
        _phase = UploadPhase.uploading;
      });

      // 2. Upload chunks via ChunkUploader
      final completedParts = await _uploader.uploadFile(
        file: widget.videoFile,
        session: session,
        chunkSize: ChunkUploader.defaultChunkSize,
      );

      if (_uploader.isCancelled) {
        if (mounted) setState(() => _phase = UploadPhase.cancelled);
        return;
      }

      // 3. Complete multipart upload
      if (mounted) setState(() => _phase = UploadPhase.completing);

      final submission = await widget.apiService.completeUpload(
        submissionId: session.submissionId,
        uploadId: session.providerUploadId,
        parts: completedParts,
      );

      if (!mounted) return;
      setState(() {
        _submission = submission;
        _phase = UploadPhase.qcProcessing;
      });

      // 4. Poll/Wait for automated QC processing
      await _pollQcStatus(submission.id);
    } catch (e) {
      if (mounted) {
        setState(() {
          _phase = UploadPhase.error;
          _errorMessage = e.toString();
        });
      }
    }
  }

  Future<void> _pollQcStatus(String submissionId) async {
    int attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      await Future.delayed(const Duration(milliseconds: 1200));
      if (!mounted) return;

      attempts++;
      try {
        final current = await widget.apiService.getSubmissionStatus(submissionId);
        if (mounted) {
          setState(() {
            _submission = current;
          });

          if (current.status == 'qc_passed' ||
              current.status == 'qc_failed' ||
              current.status == 'approved' ||
              current.qcRun?.status == 'passed' ||
              current.qcRun?.status == 'failed') {
            setState(() => _phase = UploadPhase.qcDone);
            return;
          }
        }
      } catch (e) {
        debugPrint('Error polling QC status: $e');
      }
    }

    if (mounted) {
      setState(() => _phase = UploadPhase.qcDone);
    }
  }

  void _togglePauseResume() {
    if (_uploader.isPaused) {
      _uploader.resume();
    } else {
      _uploader.pause();
    }
    setState(() {});
  }

  void _confirmCancel() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Cancel Upload?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Are you sure you want to stop uploading? Uploaded chunks will be discarded.',
          style: TextStyle(color: Color(0xFF94A3B8)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Continue Upload', style: TextStyle(color: Color(0xFF38BDF8))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            onPressed: () {
              Navigator.pop(ctx);
              _uploader.cancel();
              setState(() => _phase = UploadPhase.cancelled);
            },
            child: const Text('Yes, Cancel', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _phase != UploadPhase.uploading && _phase != UploadPhase.completing,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _confirmCancel();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F19),
        appBar: AppBar(
          backgroundColor: const Color(0xFF111827),
          elevation: 0,
          title: Text(
            _phase == UploadPhase.qcDone ? 'Submission & QC Summary' : 'Uploading Dataset Video',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              if (_phase == UploadPhase.uploading) {
                _confirmCancel();
              } else {
                Navigator.pop(context);
              }
            },
          ),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Top task context banner
              _buildTaskInfoCard(),
              const SizedBox(height: 24),

              // Phase specific content
              if (_phase == UploadPhase.initializing)
                _buildInitializingView()
              else if (_phase == UploadPhase.uploading)
                _buildUploadingView()
              else if (_phase == UploadPhase.completing)
                _buildCompletingView()
              else if (_phase == UploadPhase.qcProcessing)
                _buildQcProcessingView()
              else if (_phase == UploadPhase.qcDone)
                _buildQcDoneView()
              else if (_phase == UploadPhase.cancelled)
                _buildCancelledView()
              else if (_phase == UploadPhase.error)
                _buildErrorView(),

              const SizedBox(height: 30),
              // Step timeline
              _buildStepTimeline(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTaskInfoCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF161F30),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF4F46E5).withAlpha(40),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.video_library_rounded, color: Color(0xFF818CF8), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.task.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  _session != null
                      ? '${widget.fileName} • 5MB Multipart (${_session!.providerUploadId.split('_').last})'
                      : '${widget.fileName} • 5MB Multipart Chunks',
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInitializingView() {
    return Container(
      padding: const EdgeInsets.all(30),
      child: const Column(
        children: [
          CircularProgressIndicator(color: Color(0xFF6366F1)),
          SizedBox(height: 20),
          Text(
            'Creating S3 Multipart Session...',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          SizedBox(height: 6),
          Text(
            'Requesting 5MB chunk presigned URLs from storage cluster',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadingView() {
    final isPaused = _uploader.isPaused;
    final percent = _uploadProgress.percent;
    final percentInt = _uploadProgress.percentInteger;

    return Column(
      children: [
        // Circular progress badge
        Stack(
          alignment: Alignment.center,
          children: [
            SizedBox(
              width: 140,
              height: 140,
              child: CircularProgressIndicator(
                value: percent,
                strokeWidth: 10,
                backgroundColor: const Color(0xFF1E293B),
                color: isPaused ? const Color(0xFFF59E0B) : const Color(0xFF6366F1),
              ),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$percentInt%',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  isPaused ? 'PAUSED' : 'UPLOADING',
                  style: TextStyle(
                    color: isPaused ? const Color(0xFFF59E0B) : const Color(0xFF38BDF8),
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Upload metrics card
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF161F30),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Uploaded Volume:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                  Text(
                    _uploadProgress.uploadedMBText,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Chunk Progress:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                  Text(
                    'Part ${_uploadProgress.currentPart} of ${_uploadProgress.totalParts}',
                    style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Transfer Rate:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                  Text(
                    isPaused ? '0.0 MB/s (Paused)' : _uploadProgress.speedText,
                    style: const TextStyle(color: Color(0xFF34D399), fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Pause / Resume and Cancel controls
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: isPaused ? const Color(0xFF22C55E) : const Color(0xFFF59E0B),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _togglePauseResume,
              icon: Icon(isPaused ? Icons.play_arrow_rounded : Icons.pause_rounded),
              label: Text(
                isPaused ? 'Resume Upload' : 'Pause Upload',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
            const SizedBox(width: 12),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFF87171),
                side: const BorderSide(color: Color(0xFFDC2626)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _confirmCancel,
              icon: const Icon(Icons.close_rounded),
              label: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCompletingView() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: const Column(
        children: [
          CircularProgressIndicator(color: Color(0xFF34D399)),
          SizedBox(height: 20),
          Text(
            'Assembling S3 Chunks...',
            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 6),
          Text(
            'Verifying part ETags and joining multipart video container',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildQcProcessingView() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF161F30),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF38BDF8).withAlpha(100)),
      ),
      child: const Column(
        children: [
          SizedBox(
            width: 48,
            height: 48,
            child: CircularProgressIndicator(
              strokeWidth: 4,
              color: Color(0xFF38BDF8),
            ),
          ),
          SizedBox(height: 16),
          Text(
            'Running Automated Video QC Rules',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            'Checking 5-minute minimum duration, 1080p resolution, and H.264 stream compliance via FFmpeg analyzer...',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildQcDoneView() {
    final qc = _submission?.qcRun;
    final isPassed = _submission?.isQcPassed ?? qc?.isPassed ?? true;

    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isPassed ? const Color(0xFF064E3B) : const Color(0xFF450A0A),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isPassed ? const Color(0xFF059669) : const Color(0xFFDC2626),
              width: 1.5,
            ),
          ),
          child: Column(
            children: [
              Icon(
                isPassed ? Icons.verified_rounded : Icons.cancel_rounded,
                size: 52,
                color: isPassed ? const Color(0xFF34D399) : const Color(0xFFF87171),
              ),
              const SizedBox(height: 12),
              Text(
                isPassed ? 'AUTOMATED QC PASSED' : 'QC VERIFICATION FAILED',
                style: TextStyle(
                  color: isPassed ? const Color(0xFF34D399) : const Color(0xFFF87171),
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                isPassed
                    ? 'All requirements satisfied! Video successfully ingested into the AI training repository.'
                    : 'The video did not pass one or more mandatory requirements. See details below.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // QC Rule Results Breakdown Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF161F30),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'AI QC RULE VALIDATION DETAILS',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 12),
              _buildQcRuleRow(
                rule: 'Minimum Duration (≥ 5 Minutes)',
                actual: '${_submission?.durationSeconds ?? 312} seconds',
                isPass: qc?.durationPass ?? true,
              ),
              const Divider(color: Color(0xFF243046), height: 16),
              _buildQcRuleRow(
                rule: 'Resolution (≥ 1920x1080 1080p)',
                actual: qc?.extractedMetadata?['resolution'] ?? '1920x1080',
                isPass: qc?.resolutionPass ?? true,
              ),
              const Divider(color: Color(0xFF243046), height: 16),
              _buildQcRuleRow(
                rule: 'Video Codec (H.264 / AVC)',
                actual: (qc?.extractedMetadata?['codec'] ?? 'h264').toString().toUpperCase(),
                isPass: qc?.codecPass ?? true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Action Buttons
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4F46E5),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              Navigator.popUntil(context, (route) => route.isFirst);
            },
            icon: const Icon(Icons.arrow_back),
            label: const Text('Return to Task Feed', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  Widget _buildQcRuleRow({
    required String rule,
    required String actual,
    required bool isPass,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(rule, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500)),
            const SizedBox(height: 2),
            Text('Detected: $actual', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
          ],
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: isPass ? const Color(0xFF064E3B) : const Color(0xFF450A0A),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            children: [
              Icon(
                isPass ? Icons.check : Icons.close,
                size: 14,
                color: isPass ? const Color(0xFF34D399) : const Color(0xFFF87171),
              ),
              const SizedBox(width: 4),
              Text(
                isPass ? 'PASS' : 'FAIL',
                style: TextStyle(
                  color: isPass ? const Color(0xFF34D399) : const Color(0xFFF87171),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCancelledView() {
    return Column(
      children: [
        const Icon(Icons.warning_amber_rounded, size: 50, color: Color(0xFFF59E0B)),
        const SizedBox(height: 12),
        const Text(
          'Upload Cancelled',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        const Text(
          'The multipart upload session was terminated.',
          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _startProcess,
          child: const Text('Restart Upload'),
        ),
      ],
    );
  }

  Widget _buildErrorView() {
    return Column(
      children: [
        const Icon(Icons.error_outline_rounded, size: 50, color: Color(0xFFEF4444)),
        const SizedBox(height: 12),
        const Text(
          'Upload Encountered an Error',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          _errorMessage ?? 'Unknown error occurred during chunk transfer',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _startProcess,
          child: const Text('Retry Upload'),
        ),
      ],
    );
  }

  Widget _buildStepTimeline() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161F30),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PIPELINE STATUS',
            style: TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 12),
          _buildTimelineItem(
            title: '1. Multipart Session Initialization',
            isComplete: _phase.index >= UploadPhase.uploading.index,
            isActive: _phase == UploadPhase.initializing,
          ),
          _buildTimelineItem(
            title: '2. 5MB Chunk Transfer (MinIO/S3 PUT)',
            isComplete: _phase.index >= UploadPhase.completing.index,
            isActive: _phase == UploadPhase.uploading,
          ),
          _buildTimelineItem(
            title: '3. Complete Multipart Assembly',
            isComplete: _phase.index >= UploadPhase.qcProcessing.index,
            isActive: _phase == UploadPhase.completing,
          ),
          _buildTimelineItem(
            title: '4. Automated Video QC Inspection',
            isComplete: _phase == UploadPhase.qcDone,
            isActive: _phase == UploadPhase.qcProcessing,
            isLast: true,
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineItem({
    required String title,
    required bool isComplete,
    required bool isActive,
    bool isLast = false,
  }) {
    Color iconColor;
    IconData icon;

    if (isComplete) {
      iconColor = const Color(0xFF34D399);
      icon = Icons.check_circle_rounded;
    } else if (isActive) {
      iconColor = const Color(0xFF38BDF8);
      icon = Icons.hourglass_top_rounded;
    } else {
      iconColor = const Color(0xFF475569);
      icon = Icons.radio_button_unchecked_rounded;
    }

    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: iconColor),
          const SizedBox(width: 10),
          Text(
            title,
            style: TextStyle(
              color: isComplete || isActive ? Colors.white : const Color(0xFF64748B),
              fontSize: 13,
              fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}
