import 'package:flutter/material.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../widgets/requirement_badge.dart';
import 'task_detail_screen.dart';

class TaskListScreen extends StatefulWidget {
  final ApiService apiService;

  const TaskListScreen({super.key, required this.apiService});

  @override
  State<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends State<TaskListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Task> _allTasks = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _workerId = 'worker-1';
  String _currentBaseUrl = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadInitialData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    final worker = await widget.apiService.getWorkerId();
    final url = await widget.apiService.getBaseUrl();
    if (mounted) {
      setState(() {
        _workerId = worker ?? 'worker-1';
        _currentBaseUrl = url;
      });
    }
    await _fetchTasks();
  }

  Future<void> _fetchTasks() async {
    try {
      final tasks = await widget.apiService.getTasks();
      if (mounted) {
        setState(() {
          _allTasks = tasks;
          _isLoading = false;
          _errorMessage = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString();
        });
      }
    }
  }

  List<Task> _getFilteredTasks(int tabIndex) {
    switch (tabIndex) {
      case 1: // Available
        return _allTasks
            .where((t) => !t.isAssigned && t.remainingSlots > 0)
            .toList();
      case 2: // Assigned to Me
        return _allTasks.where((t) => t.isAssigned).toList();
      default: // All
        return _allTasks;
    }
  }

  void _showServerSettingsDialog() {
    final controller = TextEditingController(text: _currentBaseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Backend API Server', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Set FastAPI base URL for upload sessions and video QC validation:',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                filled: true,
                fillColor: Color(0xFF0F172A),
                hintText: 'http://localhost:8000/api/v1',
                hintStyle: TextStyle(color: Color(0xFF64748B)),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: [
                ActionChip(
                  label: const Text('localhost:8000', style: TextStyle(fontSize: 11)),
                  onPressed: () => controller.text = 'http://localhost:8000/api/v1',
                ),
                ActionChip(
                  label: const Text('10.0.2.2:8000 (Android)', style: TextStyle(fontSize: 11)),
                  onPressed: () => controller.text = 'http://10.0.2.2:8000/api/v1',
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () async {
              final newUrl = controller.text.trim();
              if (newUrl.isNotEmpty) {
                await widget.apiService.setBaseUrl(newUrl);
                if (!mounted) return;
                setState(() => _currentBaseUrl = newUrl);
                if (ctx.mounted) Navigator.pop(ctx);
                _fetchTasks();
              }
            },
            child: const Text('Save & Reconnect'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      appBar: AppBar(
        backgroundColor: const Color(0xFF111827),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFF4F46E5),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.videocam_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'AI Video Collector',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Text(
                  'Worker Platform',
                  style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Server Connection',
            icon: const Icon(Icons.dns_outlined, color: Color(0xFF38BDF8)),
            onPressed: _showServerSettingsDialog,
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
            onPressed: _fetchTasks,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF6366F1),
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF94A3B8),
          tabs: const [
            Tab(text: 'All Tasks'),
            Tab(text: 'Available'),
            Tab(text: 'My Tasks'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Worker status bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFF161F30),
            child: Row(
              children: [
                const Icon(Icons.account_circle_outlined,
                    size: 16, color: Color(0xFF94A3B8)),
                const SizedBox(width: 6),
                Text(
                  'Worker ID: $_workerId',
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
                const Spacer(),
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF22C55E),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                const Text(
                  'Ready to Record',
                  style: TextStyle(
                    color: Color(0xFF22C55E),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          // Tab views
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF6366F1)),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.cloud_off_rounded,
                                size: 48, color: Colors.amber),
                            const SizedBox(height: 12),
                            Text(
                              'Failed to fetch tasks',
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 16),
                            ),
                            const SizedBox(height: 8),
                            ElevatedButton(
                              onPressed: _fetchTasks,
                              child: const Text('Try Again'),
                            ),
                          ],
                        ),
                      )
                    : TabBarView(
                        controller: _tabController,
                        children: [
                          _buildTaskList(_getFilteredTasks(0)),
                          _buildTaskList(_getFilteredTasks(1)),
                          _buildTaskList(_getFilteredTasks(2)),
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskList(List<Task> tasks) {
    if (tasks.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inbox_outlined, size: 48, color: Colors.grey.shade600),
            const SizedBox(height: 12),
            const Text(
              'No tasks found in this section',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 15),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: const Color(0xFF6366F1),
      onRefresh: _fetchTasks,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        itemCount: tasks.length,
        itemBuilder: (context, index) {
          final task = tasks[index];
          return _buildTaskCard(task);
        },
      ),
    );
  }

  Widget _buildTaskCard(Task task) {
    return Card(
      color: const Color(0xFF161F30),
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: task.isAssigned
              ? const Color(0xFF6366F1)
              : const Color(0xFF1E293B),
          width: task.isAssigned ? 1.5 : 1.0,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () async {
          final updated = await Navigator.push<Task?>(
            context,
            MaterialPageRoute(
              builder: (ctx) => TaskDetailScreen(
                task: task,
                apiService: widget.apiService,
              ),
            ),
          );
          if (updated != null) {
            _fetchTasks();
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top category & assigned badge
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      task.category.toUpperCase(),
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (task.isAssigned)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF312E81),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xFF4F46E5)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle_outline,
                              size: 12, color: Color(0xFFA5B4FC)),
                          SizedBox(width: 4),
                          Text(
                            'ASSIGNED',
                            style: TextStyle(
                              color: Color(0xFFA5B4FC),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    RequirementBadge.slots(task.remainingSlots),
                ],
              ),
              const SizedBox(height: 10),
              // Title
              Text(
                task.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 6),
              // Description excerpt
              Text(
                task.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 12),
              // Requirement Badges Row: 5-min requirement & 1080p requirement
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  RequirementBadge.duration(task.durationBadgeText),
                  RequirementBadge.resolution(task.resolutionBadgeText),
                  RequirementBadge.codec(task.codecBadgeText),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(color: Color(0xFF243046), height: 1),
              const SizedBox(height: 10),
              // Action button row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    task.isAssigned
                        ? 'Ready for upload'
                        : '${task.remainingSlots} slots remaining',
                    style: TextStyle(
                      color: task.isAssigned
                          ? const Color(0xFF34D399)
                          : const Color(0xFF64748B),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Row(
                    children: [
                      Text(
                        task.isAssigned ? 'Open Details' : 'View Requirements',
                        style: const TextStyle(
                          color: Color(0xFF818CF8),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 12,
                        color: Color(0xFF818CF8),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
