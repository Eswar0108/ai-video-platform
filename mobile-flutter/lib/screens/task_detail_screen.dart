import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../widgets/requirement_badge.dart';
import 'upload_progress_screen.dart';

class TaskDetailScreen extends StatefulWidget {
  final Task task;
  final ApiService apiService;

  const TaskDetailScreen({
    super.key,
    required this.task,
    required this.apiService,
  });

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  late Task _task;
  bool _isClaiming = false;
  File? _selectedVideoFile;
  int? _videoSizeBytes;
  String? _videoFileName;
  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _task = widget.task;
  }

  Future<void> _claimTask() async {
    setState(() => _isClaiming = true);
    try {
      final updatedTask = await widget.apiService.claimTask(_task.id);
      if (mounted) {
        setState(() {
          _task = updatedTask;
          _isClaiming = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF059669),
            content: Text('Task successfully claimed! You can now record and upload your video.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isClaiming = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red.shade800,
            content: Text('Failed to claim task: $e'),
          ),
        );
      }
    }
  }

  Future<void> _recordVideoWithCamera() async {
    try {
      final XFile? recorded = await _imagePicker.pickVideo(
        source: ImageSource.camera,
        maxDuration: Duration(seconds: _task.maxDurationSeconds),
      );

      if (recorded != null) {
        final file = File(recorded.path);
        final size = await file.length();
        setState(() {
          _selectedVideoFile = file;
          _videoSizeBytes = size;
          _videoFileName = recorded.name;
        });
      }
    } catch (e) {
      _showErrorDialog('Could not open camera: $e');
    }
  }

  Future<void> _pickVideoFromGallery() async {
    try {
      final XFile? picked = await _imagePicker.pickVideo(
        source: ImageSource.gallery,
      );

      if (picked != null) {
        final file = File(picked.path);
        final size = await file.length();
        setState(() {
          _selectedVideoFile = file;
          _videoSizeBytes = size;
          _videoFileName = picked.name;
        });
      }
    } catch (e) {
      _showErrorDialog('Could not pick video from gallery: $e');
    }
  }

  Future<void> _pickVideoFile() async {
    try {
      final files = await FilePicker.pickFiles(
        type: FileType.video,
      );

      if (files.isNotEmpty && files.first.path != null) {
        final path = files.first.path!;
        final file = File(path);
        final size = await file.length();
        setState(() {
          _selectedVideoFile = file;
          _videoSizeBytes = size;
          _videoFileName = files.first.name;
        });
      }
    } catch (e) {
      _showErrorDialog('Could not pick video file: $e');
    }
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Video Selection Error', style: TextStyle(color: Colors.white)),
        content: Text(message, style: const TextStyle(color: Color(0xFF94A3B8))),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      appBar: AppBar(
        backgroundColor: const Color(0xFF111827),
        elevation: 0,
        title: const Text(
          'Task Details & Guidelines',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Category & Status
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _task.category.toUpperCase(),
                    style: const TextStyle(
                      color: Color(0xFF38BDF8),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const Spacer(),
                if (_task.isAssigned)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF064E3B),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFF059669)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.check_circle, size: 14, color: Color(0xFF34D399)),
                        SizedBox(width: 4),
                        Text(
                          'ASSIGNED TO YOU',
                          style: TextStyle(
                            color: Color(0xFF34D399),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  RequirementBadge.slots(_task.remainingSlots),
              ],
            ),
            const SizedBox(height: 12),
            // Title
            Text(
              _task.title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 10),
            // Description
            Text(
              _task.description,
              style: const TextStyle(
                color: Color(0xFFCBD5E1),
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 20),

            // Mandatory Technical Requirements Grid
            const Text(
              'MANDATORY TECHNICAL REQUIREMENTS',
              style: TextStyle(
                color: Color(0xFF94A3B8),
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 10),
            _buildRequirementsGrid(),

            const SizedBox(height: 20),
            // Recording Guidelines
            const Text(
              'RECORDING & DATASET GUIDELINES',
              style: TextStyle(
                color: Color(0xFF94A3B8),
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 10),
            _buildGuidelinesCard(),

            const SizedBox(height: 24),

            // Claim or Video Selector Area
            if (!_task.isAssigned)
              _buildClaimSection()
            else
              _buildVideoPickerSection(),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildRequirementsGrid() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161F30),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        children: [
          _buildRequirementRow(
            icon: Icons.timer_outlined,
            iconColor: const Color(0xFF38BDF8),
            title: 'Minimum Duration',
            value: '${(_task.minDurationSeconds / 60).round()} Minutes (Continuous)',
            subtitle: 'AI QC rule rejects files under ${_task.minDurationSeconds} seconds',
          ),
          const Divider(color: Color(0xFF243046), height: 20),
          _buildRequirementRow(
            icon: Icons.hd_outlined,
            iconColor: const Color(0xFF34D399),
            title: 'Minimum Resolution',
            value: '${_task.minResolution} (1080p FHD)',
            subtitle: 'Clear, crisp focus with no camera motion blur',
          ),
          const Divider(color: Color(0xFF243046), height: 20),
          _buildRequirementRow(
            icon: Icons.video_file_outlined,
            iconColor: const Color(0xFF818CF8),
            title: 'Video Codec & Format',
            value: '${_task.requiredCodec.toUpperCase()} / MP4 or MOV',
            subtitle: 'Standard baseline or high profile H.264 video stream',
          ),
        ],
      ),
    );
  }

  Widget _buildRequirementRow({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String value,
    required String subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: iconColor.withAlpha(30),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGuidelinesCard() {
    final guidelines = [
      'Maintain stable camera orientation (mount on tripod or phone stand if possible).',
      'Ensure bright, even lighting without direct glare into the camera sensor.',
      'Perform actions in a natural, deliberate manner for AI perception training.',
      'No background copyrighted music, identifiable faces of bystanders, or private information.',
      'Record in a single uninterrupted take. Do not edit, apply filters, or trim intermediate actions.',
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF161F30),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        children: guidelines.map((item) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.check_circle_outline,
                    size: 16, color: Color(0xFF38BDF8)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    item,
                    style: const TextStyle(
                      color: Color(0xFFCBD5E1),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildClaimSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF161F30),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF3730A3)),
      ),
      child: Column(
        children: [
          const Icon(Icons.assignment_turned_in_outlined,
              size: 40, color: Color(0xFF818CF8)),
          const SizedBox(height: 12),
          const Text(
            'Claim Task to Start Recording',
            style: TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Claiming reserves 1 of the available slots for 24 hours while you record and upload your dataset video.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: _isClaiming ? null : _claimTask,
              icon: _isClaiming
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.lock_open_rounded),
              label: Text(
                _isClaiming ? 'Claiming Slot...' : 'Claim This Task',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVideoPickerSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'VIDEO CAPTURE & SELECTION',
          style: TextStyle(
            color: Color(0xFF94A3B8),
            fontSize: 12,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 12),
        // Picker buttons row
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E293B),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(color: Color(0xFF334155)),
                  ),
                ),
                onPressed: _recordVideoWithCamera,
                icon: const Icon(Icons.camera_alt_outlined, color: Color(0xFF38BDF8)),
                label: const Text('Camera'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E293B),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(color: Color(0xFF334155)),
                  ),
                ),
                onPressed: _pickVideoFromGallery,
                icon: const Icon(Icons.photo_library_outlined, color: Color(0xFF34D399)),
                label: const Text('Gallery'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E293B),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(color: Color(0xFF334155)),
                  ),
                ),
                onPressed: _pickVideoFile,
                icon: const Icon(Icons.folder_open_outlined, color: Color(0xFFFBBF24)),
                label: const Text('Files'),
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        // Selected video preview card
        if (_selectedVideoFile != null) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF161F30),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF22C55E)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF064E3B),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.movie_outlined,
                          color: Color(0xFF34D399), size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _videoFileName ?? 'Selected Video',
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
                            _videoSizeBytes != null
                                ? 'Size: ${_formatFileSize(_videoSizeBytes!)} • Ready for chunked upload'
                                : 'Ready for upload',
                            style: const TextStyle(
                              color: Color(0xFF34D399),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () {
                        setState(() {
                          _selectedVideoFile = null;
                          _videoSizeBytes = null;
                          _videoFileName = null;
                        });
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 14, color: Color(0xFF38BDF8)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Uploads via 5MB chunks to S3/MinIO with automatic pause/resume.',
                          style: TextStyle(color: Colors.grey.shade400, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Proceed button
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF22C55E),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (ctx) => UploadProgressScreen(
                      task: _task,
                      videoFile: _selectedVideoFile!,
                      fileName: _videoFileName ?? 'video.mp4',
                      fileSizeBytes: _videoSizeBytes ?? 0,
                      apiService: widget.apiService,
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.cloud_upload_rounded),
              label: const Text(
                'Start Chunked Upload & QC',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ] else ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 30, horizontal: 20),
            decoration: BoxDecoration(
              color: const Color(0xFF161F30),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFF334155),
                style: BorderStyle.solid,
              ),
            ),
            child: Column(
              children: [
                Icon(Icons.video_library_outlined,
                    size: 40, color: Colors.grey.shade500),
                const SizedBox(height: 10),
                const Text(
                  'No video selected yet',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Use Camera, Gallery, or Files above to pick your recording',
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
