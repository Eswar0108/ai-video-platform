class UploadPartPresigned {
  final int partNumber;
  final String url;

  const UploadPartPresigned({
    required this.partNumber,
    required this.url,
  });

  factory UploadPartPresigned.fromJson(Map<String, dynamic> json) {
    return UploadPartPresigned(
      partNumber: json['part_number'] as int? ?? json['partNumber'] as int? ?? 1,
      url: json['url'] as String? ?? json['upload_url'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'part_number': partNumber,
      'url': url,
    };
  }
}

class CompletedPart {
  final int partNumber;
  final String eTag;

  const CompletedPart({
    required this.partNumber,
    required this.eTag,
  });

  factory CompletedPart.fromJson(Map<String, dynamic> json) {
    return CompletedPart(
      partNumber: json['part_number'] as int? ?? json['partNumber'] as int? ?? 1,
      eTag: json['etag'] as String? ?? json['eTag'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'part_number': partNumber,
      'etag': eTag,
    };
  }
}

class UploadSession {
  final String id;
  final String submissionId;
  final String providerUploadId;
  final int partSizeBytes;
  final int totalParts;
  final String status;
  final List<UploadPartPresigned> presignedParts;
  final DateTime? expiresAt;
  final DateTime? createdAt;

  const UploadSession({
    required this.id,
    required this.submissionId,
    required this.providerUploadId,
    this.partSizeBytes = 5242880, // 5 MB chunks
    this.totalParts = 1,
    this.status = 'in_progress',
    this.presignedParts = const [],
    this.expiresAt,
    this.createdAt,
  });

  factory UploadSession.fromJson(Map<String, dynamic> json) {
    var rawParts = json['presigned_parts'] ?? json['presigned_urls'] ?? json['parts'];
    List<UploadPartPresigned> parts = [];
    if (rawParts is List) {
      parts = rawParts
          .map((item) => item is Map<String, dynamic>
              ? UploadPartPresigned.fromJson(item)
              : null)
          .whereType<UploadPartPresigned>()
          .toList();
    } else if (rawParts is Map) {
      // Map of partNumber -> url
      rawParts.forEach((key, value) {
        final num = int.tryParse(key.toString()) ?? 1;
        parts.add(UploadPartPresigned(partNumber: num, url: value.toString()));
      });
    }

    return UploadSession(
      id: json['id'] as String? ?? '',
      submissionId: json['submission_id'] as String? ??
          json['submissionId'] as String? ??
          '',
      providerUploadId: json['provider_upload_id'] as String? ??
          json['upload_id'] as String? ??
          json['uploadId'] as String? ??
          '',
      partSizeBytes: json['part_size_bytes'] as int? ??
          json['partSizeBytes'] as int? ??
          5242880,
      totalParts: json['total_parts'] as int? ??
          json['totalParts'] as int? ??
          parts.length,
      status: json['status'] as String? ?? 'in_progress',
      presignedParts: parts,
      expiresAt: json['expires_at'] != null
          ? DateTime.tryParse(json['expires_at'] as String)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'submission_id': submissionId,
      'provider_upload_id': providerUploadId,
      'part_size_bytes': partSizeBytes,
      'total_parts': totalParts,
      'status': status,
      'presigned_parts': presignedParts.map((p) => p.toJson()).toList(),
      'expires_at': expiresAt?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
    };
  }
}

class QCRun {
  final String id;
  final String submissionId;
  final String status; // 'pending', 'processing', 'passed', 'failed'
  final Map<String, dynamic>? extractedMetadata;
  final Map<String, dynamic>? ruleResults;
  final String? errorMessage;
  final DateTime? completedAt;

  const QCRun({
    required this.id,
    required this.submissionId,
    this.status = 'pending',
    this.extractedMetadata,
    this.ruleResults,
    this.errorMessage,
    this.completedAt,
  });

  bool get isPassed => status.toLowerCase() == 'passed';
  bool get isFailed => status.toLowerCase() == 'failed';
  bool get isProcessing =>
      status.toLowerCase() == 'pending' || status.toLowerCase() == 'processing';

  bool? get durationPass =>
      ruleResults?['duration_pass'] as bool? ??
      ruleResults?['durationPass'] as bool?;

  bool? get codecPass =>
      ruleResults?['codec_pass'] as bool? ??
      ruleResults?['codecPass'] as bool?;

  bool? get resolutionPass =>
      ruleResults?['resolution_pass'] as bool? ??
      ruleResults?['resolutionPass'] as bool?;

  factory QCRun.fromJson(Map<String, dynamic> json) {
    return QCRun(
      id: json['id'] as String? ?? '',
      submissionId: json['submission_id'] as String? ??
          json['submissionId'] as String? ??
          '',
      status: json['status'] as String? ?? 'pending',
      extractedMetadata: json['extracted_metadata'] as Map<String, dynamic>? ??
          json['extractedMetadata'] as Map<String, dynamic>?,
      ruleResults: json['rule_results'] as Map<String, dynamic>? ??
          json['ruleResults'] as Map<String, dynamic>?,
      errorMessage: json['error_message'] as String? ??
          json['errorMessage'] as String?,
      completedAt: json['completed_at'] != null
          ? DateTime.tryParse(json['completed_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'submission_id': submissionId,
      'status': status,
      'extracted_metadata': extractedMetadata,
      'rule_results': ruleResults,
      'error_message': errorMessage,
      'completed_at': completedAt?.toIso8601String(),
    };
  }
}

class VideoSubmission {
  final String id;
  final String assignmentId;
  final String? workerId;
  final int submissionVersion;
  final String storageKey;
  final String fileName;
  final int fileSizeBytes;
  final int? durationSeconds;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final UploadSession? uploadSession;
  final QCRun? qcRun;

  const VideoSubmission({
    required this.id,
    required this.assignmentId,
    this.workerId,
    this.submissionVersion = 1,
    required this.storageKey,
    required this.fileName,
    required this.fileSizeBytes,
    this.durationSeconds,
    this.status = 'uploading',
    this.createdAt,
    this.updatedAt,
    this.uploadSession,
    this.qcRun,
  });

  bool get isUploading => status == 'uploading';
  bool get isQcProcessing => status == 'qc_processing';
  bool get isQcPassed => status == 'qc_passed' || status == 'approved';
  bool get isQcFailed => status == 'qc_failed' || status == 'rejected';

  factory VideoSubmission.fromJson(Map<String, dynamic> json) {
    return VideoSubmission(
      id: json['id'] as String? ?? '',
      assignmentId: json['assignment_id'] as String? ??
          json['assignmentId'] as String? ??
          '',
      workerId: json['worker_id'] as String? ??
          json['workerId'] as String?,
      submissionVersion: json['submission_version'] as int? ??
          json['submissionVersion'] as int? ??
          1,
      storageKey: json['storage_key'] as String? ??
          json['storageKey'] as String? ??
          '',
      fileName: json['file_name'] as String? ??
          json['fileName'] as String? ??
          'video.mp4',
      fileSizeBytes: json['file_size_bytes'] as int? ??
          json['fileSizeBytes'] as int? ??
          0,
      durationSeconds: json['duration_seconds'] as int? ??
          json['durationSeconds'] as int?,
      status: json['status'] as String? ?? 'uploading',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'] as String)
          : null,
      uploadSession: json['upload_session'] != null
          ? UploadSession.fromJson(
              json['upload_session'] as Map<String, dynamic>)
          : null,
      qcRun: json['qc_run'] != null
          ? QCRun.fromJson(json['qc_run'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'assignment_id': assignmentId,
      'worker_id': workerId,
      'submission_version': submissionVersion,
      'storage_key': storageKey,
      'file_name': fileName,
      'file_size_bytes': fileSizeBytes,
      'duration_seconds': durationSeconds,
      'status': status,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'upload_session': uploadSession?.toJson(),
      'qc_run': qcRun?.toJson(),
    };
  }
}
