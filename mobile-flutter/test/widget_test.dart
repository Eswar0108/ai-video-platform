import 'package:flutter_test/flutter_test.dart';
import 'package:aivideo_mobile/main.dart';
import 'package:aivideo_mobile/models/task.dart';
import 'package:aivideo_mobile/models/submission.dart';
import 'package:aivideo_mobile/services/api_service.dart';
import 'package:aivideo_mobile/services/chunk_uploader.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Task Model Tests', () {
    test('Task JSON parsing and badge calculations', () {
      final json = {
        'id': 'task-100',
        'title': 'Test Kitchen Video',
        'description': 'Test kitchen description',
        'category': 'Culinary',
        'min_duration_seconds': 300,
        'required_codec': 'h264',
        'min_resolution': '1920x1080',
        'total_slots': 10,
        'claimed_slots': 4,
        'status': 'published',
      };

      final task = Task.fromJson(json);

      expect(task.id, 'task-100');
      expect(task.durationBadgeText, '5 Min+');
      expect(task.resolutionBadgeText, '1080p FHD');
      expect(task.codecBadgeText, 'H264');
      expect(task.remainingSlots, 6);
      expect(task.isAssigned, false);
    });

    test('Task serialization round-trip', () {
      const task = Task(
        id: 'task-200',
        title: 'Keyboard Assembly',
        description: 'Record keyboard assembly',
        minDurationSeconds: 360,
      );

      final json = task.toJson();
      final parsed = Task.fromJson(json);

      expect(parsed.id, task.id);
      expect(parsed.title, task.title);
      expect(parsed.minDurationSeconds, 360);
    });
  });

  group('Submission & UploadSession Model Tests', () {
    test('UploadSession parsing and presigned parts', () {
      final sessionJson = {
        'id': 'sess-1',
        'submission_id': 'sub-1',
        'provider_upload_id': 'mp-up-1',
        'part_size_bytes': 5242880,
        'total_parts': 3,
        'status': 'in_progress',
        'presigned_parts': [
          {'part_number': 1, 'url': 'https://s3.local/part1'},
          {'part_number': 2, 'url': 'https://s3.local/part2'},
          {'part_number': 3, 'url': 'https://s3.local/part3'},
        ],
      };

      final session = UploadSession.fromJson(sessionJson);
      expect(session.id, 'sess-1');
      expect(session.presignedParts.length, 3);
      expect(session.presignedParts[1].partNumber, 2);
    });

    test('VideoSubmission with QCRun parsing', () {
      final submissionJson = {
        'id': 'sub-99',
        'assignment_id': 'assign-1',
        'storage_key': 'key/sub-99.mp4',
        'file_name': 'my_video.mp4',
        'file_size_bytes': 15728640,
        'duration_seconds': 320,
        'status': 'qc_passed',
        'qc_run': {
          'id': 'qc-1',
          'submission_id': 'sub-99',
          'status': 'passed',
          'rule_results': {
            'duration_pass': true,
            'resolution_pass': true,
            'codec_pass': true,
          },
        },
      };

      final submission = VideoSubmission.fromJson(submissionJson);
      expect(submission.isQcPassed, true);
      expect(submission.qcRun?.durationPass, true);
      expect(submission.qcRun?.resolutionPass, true);
      expect(submission.qcRun?.codecPass, true);
    });
  });

  group('ChunkUploader Unit Tests', () {
    test('ChunkUploader initializes in idle state', () {
      final uploader = ChunkUploader();
      expect(uploader.currentProgress.status, ChunkUploadStatus.idle);
      expect(uploader.isPaused, false);
      expect(uploader.isCancelled, false);
      uploader.dispose();
    });

    test('ChunkUploader pause and resume toggles state', () {
      final uploader = ChunkUploader();
      uploader.pause();
      expect(uploader.isPaused, true);
      uploader.resume();
      expect(uploader.isPaused, false);
      uploader.dispose();
    });
  });

  group('Widget Smoke Tests', () {
    testWidgets('App launches with title and tabs', (WidgetTester tester) async {
      final apiService = ApiService();
      await tester.pumpWidget(AIVideoPlatformApp(apiService: apiService));
      await tester.pumpAndSettle();

      expect(find.text('AI Video Collector'), findsOneWidget);
      expect(find.text('All Tasks'), findsOneWidget);
      expect(find.text('Available'), findsOneWidget);
      expect(find.text('My Tasks'), findsOneWidget);
    });
  });
}
