class Task {
  final String id;
  final String title;
  final String description;
  final String category;
  final int minDurationSeconds;
  final int maxDurationSeconds;
  final String requiredCodec;
  final String minResolution;
  final int totalSlots;
  final int claimedSlots;
  final String status;
  final DateTime? createdAt;
  final String? assignmentId;
  final String? assignmentStatus;
  final DateTime? claimExpiresAt;
  final DateTime? assignedAt;

  const Task({
    required this.id,
    required this.title,
    required this.description,
    this.category = 'general',
    this.minDurationSeconds = 300,
    this.maxDurationSeconds = 3600,
    this.requiredCodec = 'h264',
    this.minResolution = '1920x1080',
    this.totalSlots = 10,
    this.claimedSlots = 0,
    this.status = 'published',
    this.createdAt,
    this.assignmentId,
    this.assignmentStatus,
    this.claimExpiresAt,
    this.assignedAt,
  });

  bool get isAssigned => assignmentId != null && assignmentStatus != 'expired';

  int get remainingSlots => (totalSlots - claimedSlots).clamp(0, totalSlots);

  String get durationBadgeText {
    final mins = (minDurationSeconds / 60).round();
    return '$mins Min+';
  }

  String get resolutionBadgeText {
    if (minResolution.contains('1920') || minResolution.contains('1080')) {
      return '1080p FHD';
    } else if (minResolution.contains('3840') || minResolution.contains('4k')) {
      return '4K UHD';
    } else if (minResolution.contains('1280') || minResolution.contains('720')) {
      return '720p HD';
    }
    return minResolution;
  }

  String get codecBadgeText => requiredCodec.toUpperCase();

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Untitled Task',
      description: json['description'] as String? ?? '',
      category: json['category'] as String? ?? 'general',
      minDurationSeconds: json['min_duration_seconds'] as int? ??
          json['minDurationSeconds'] as int? ??
          300,
      maxDurationSeconds: json['max_duration_seconds'] as int? ??
          json['maxDurationSeconds'] as int? ??
          3600,
      requiredCodec: json['required_codec'] as String? ??
          json['requiredCodec'] as String? ??
          'h264',
      minResolution: json['min_resolution'] as String? ??
          json['minResolution'] as String? ??
          '1920x1080',
      totalSlots: json['total_slots'] as int? ??
          json['totalSlots'] as int? ??
          10,
      claimedSlots: json['claimed_slots'] as int? ??
          json['claimedSlots'] as int? ??
          0,
      status: json['status'] as String? ?? 'published',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
      assignmentId: json['assignment_id'] as String? ??
          json['assignmentId'] as String?,
      assignmentStatus: json['assignment_status'] as String? ??
          json['assignmentStatus'] as String?,
      claimExpiresAt: json['claim_expires_at'] != null
          ? DateTime.tryParse(json['claim_expires_at'] as String)
          : null,
      assignedAt: json['assigned_at'] != null
          ? DateTime.tryParse(json['assigned_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'category': category,
      'min_duration_seconds': minDurationSeconds,
      'max_duration_seconds': maxDurationSeconds,
      'required_codec': requiredCodec,
      'min_resolution': minResolution,
      'total_slots': totalSlots,
      'claimed_slots': claimedSlots,
      'status': status,
      'created_at': createdAt?.toIso8601String(),
      'assignment_id': assignmentId,
      'assignment_status': assignmentStatus,
      'claim_expires_at': claimExpiresAt?.toIso8601String(),
      'assigned_at': assignedAt?.toIso8601String(),
    };
  }

  Task copyWith({
    String? id,
    String? title,
    String? description,
    String? category,
    int? minDurationSeconds,
    int? maxDurationSeconds,
    String? requiredCodec,
    String? minResolution,
    int? totalSlots,
    int? claimedSlots,
    String? status,
    DateTime? createdAt,
    String? assignmentId,
    String? assignmentStatus,
    DateTime? claimExpiresAt,
    DateTime? assignedAt,
  }) {
    return Task(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      category: category ?? this.category,
      minDurationSeconds: minDurationSeconds ?? this.minDurationSeconds,
      maxDurationSeconds: maxDurationSeconds ?? this.maxDurationSeconds,
      requiredCodec: requiredCodec ?? this.requiredCodec,
      minResolution: minResolution ?? this.minResolution,
      totalSlots: totalSlots ?? this.totalSlots,
      claimedSlots: claimedSlots ?? this.claimedSlots,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      assignmentId: assignmentId ?? this.assignmentId,
      assignmentStatus: assignmentStatus ?? this.assignmentStatus,
      claimExpiresAt: claimExpiresAt ?? this.claimExpiresAt,
      assignedAt: assignedAt ?? this.assignedAt,
    );
  }
}
