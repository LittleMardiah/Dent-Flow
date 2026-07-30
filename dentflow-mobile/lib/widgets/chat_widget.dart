import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../screens/chat/chat_screen.dart';

class ChatWidget extends StatelessWidget {
  const ChatWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final chatProvider = Provider.of<ChatProvider>(context);

    return Stack(
      children: [
        // Chat bubble (if open)
        if (chatProvider.isOpen)
          Positioned(
            bottom: 80,
            right: 16,
            width: MediaQuery.of(context).size.width * 0.85,
            height: MediaQuery.of(context).size.height * 0.55,
            child: Card(
              elevation: 8,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              clipBehavior: Clip.antiAlias,
              child: const ChatScreen(),
            ),
          ),
        // Floating button
        Positioned(
          bottom: 16,
          right: 16,
          child: FloatingActionButton(
            onPressed: () {
              chatProvider.toggleOpen();
            },
            backgroundColor: Colors.blue,
            child: Icon(
              chatProvider.isOpen ? Icons.close : Icons.chat,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }
}
