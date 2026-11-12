import 'package:flutter/material.dart';

class RequirementBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final Color borderColor;

  const RequirementBadge({
    super.key,
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.textColor,
    required this.borderColor,
  });

  factory RequirementBadge.duration(String text) {
    return RequirementBadge(
      icon: Icons.timer_outlined,
      label: text,
      backgroundColor: const Color(0xFF1E293B),
      textColor: const Color(0xFF38BDF8),
      borderColor: const Color(0xFF0284C7).withAlpha(128),
    );
  }

  factory RequirementBadge.resolution(String text) {
    return RequirementBadge(
      icon: Icons.hd_outlined,
      label: text,
      backgroundColor: const Color(0xFF064E3B),
      textColor: const Color(0xFF34D399),
      borderColor: const Color(0xFF059669).withAlpha(128),
    );
  }

  factory RequirementBadge.codec(String text) {
    return RequirementBadge(
      icon: Icons.video_file_outlined,
      label: text,
      backgroundColor: const Color(0xFF312E81),
      textColor: const Color(0xFF818CF8),
      borderColor: const Color(0xFF4F46E5).withAlpha(128),
    );
  }

  factory RequirementBadge.slots(int remaining) {
    final isLow = remaining <= 2;
    return RequirementBadge(
      icon: Icons.people_outline,
      label: '$remaining slots',
      backgroundColor: isLow ? const Color(0xFF450A0A) : const Color(0xFF27272A),
      textColor: isLow ? const Color(0xFFF87171) : const Color(0xFFA1A1AA),
      borderColor: isLow ? const Color(0xFFDC2626).withAlpha(128) : const Color(0xFF52525B).withAlpha(128),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: borderColor, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: textColor),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
