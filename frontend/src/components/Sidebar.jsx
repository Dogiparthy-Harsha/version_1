import React from 'react';

const Sidebar = ({ conversations, currentConversationId, onSelectConversation, onNewChat, onDeleteConversation }) => {
    return (
        <div className="sidebar">
            <button onClick={onNewChat} className="new-chat-btn">
                + New Chat
            </button>

            <div className="conversations-list">
                {conversations.map((conv) => (
                    <div
                        key={conv.id}
                        className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
                        onClick={() => onSelectConversation(conv.id)}
                    >
                        <span className="conversation-title">{conv.title}</span>
                        <button
                            className="delete-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteConversation(conv.id);
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Sidebar;
