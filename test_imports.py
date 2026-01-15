#!/usr/bin/env python3
"""Test all LangChain imports after version upgrade"""

print("=" * 60)
print("Testing LangChain 1.2.4 Import Compatibility")
print("=" * 60)

# Test 1: Core callbacks
print("\n1. Testing core callbacks...")
try:
    from langchain_core.callbacks.manager import CallbackManagerForRetrieverRun
    from langchain_core.callbacks.base import BaseCallbackHandler
    print("   ✓ Callbacks import successfully")
except ImportError as e:
    print(f"   ✗ Failed: {e}")
    exit(1)

# Test 2: Core retrievers and documents
print("2. Testing retrievers and documents...")
try:
    from langchain_core.retrievers import BaseRetriever
    from langchain_core.documents import Document
    print("   ✓ Retrievers and documents import successfully")
except ImportError as e:
    print(f"   ✗ Failed: {e}")
    exit(1)

# Test 3: Chat history
print("3. Testing chat history...")
try:
    from langchain_core.chat_history import BaseChatMessageHistory
    print("   ✓ Chat history imports successfully")
except ImportError as e:
    print(f"   ✗ Failed: {e}")
    exit(1)

# Test 4: Messages
print("4. Testing messages...")
try:
    from langchain_core.messages import (
        BaseMessage,
        AIMessage,
        HumanMessage,
        messages_from_dict,
        messages_to_dict,
    )
    from langchain_core.messages.ai import AIMessageChunk
    print("   ✓ Messages import successfully")
except ImportError as e:
    print(f"   ✗ Failed: {e}")
    exit(1)

# Test 5: LangChain AWS
print("5. Testing langchain-aws...")
try:
    from langchain_aws import ChatBedrockConverse
    import importlib.metadata
    version = importlib.metadata.version('langchain-aws')
    from packaging.version import parse
    assert parse(version) > parse("1.0.0"), f"Version {version} is not > 1.0.0"
    print(f"   ✓ langchain-aws v{version} (> 1.0.0)")
except (ImportError, AssertionError) as e:
    print(f"   ✗ Failed: {e}")
    exit(1)

# Test 6: Other LangChain components
print("6. Testing other LangChain components...")
try:
    from langchain_classic.chains.conversation.base import ConversationChain
    from langchain_classic.chains import ConversationalRetrievalChain
    from langchain_classic.memory import ConversationBufferMemory
    from langchain_classic.prompts import PromptTemplate
    print("   ✓ Other components import successfully")
except ImportError as e:
    print(f"   ✗ Failed: {e}")
    exit(1)

print("\n" + "=" * 60)
print("✅ ALL TESTS PASSED!")
print("=" * 60)
print("\nSummary:")
print("  - All imports are compatible with LangChain 1.2.4")
print("  - langchain-aws > 1.0.0 requirement satisfied")
print("  - No module import errors")
