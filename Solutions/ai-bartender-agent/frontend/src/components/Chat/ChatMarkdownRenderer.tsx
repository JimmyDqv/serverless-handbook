import React from 'react';

interface ChatMarkdownRendererProps {
  content: string;
}

const ChatMarkdownRenderer: React.FC<ChatMarkdownRendererProps> = ({ content }) => {
  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={match.index} className="font-semibold">{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={match.index} className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag
            key={`list-${elements.length}`}
            className={`${listType === 'ul' ? 'list-disc' : 'list-decimal'} list-inside space-y-1 my-2`}
          >
            {listItems}
          </ListTag>
        );
        listItems = [];
        listType = null;
      }
    };

    lines.forEach((line, i) => {
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const className =
          level === 1
            ? 'text-lg font-bold mt-3 mb-1'
            : level === 2
              ? 'text-base font-semibold mt-2 mb-1'
              : 'text-sm font-semibold mt-2 mb-1';
        elements.push(
          <div key={i} className={className}>
            {renderInline(headingMatch[2])}
          </div>
        );
        return;
      }

      const bulletMatch = line.match(/^[-*]\s+(.+)/);
      if (bulletMatch) {
        if (listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(
          <li key={`li-${i}`} className="text-sm">
            {renderInline(bulletMatch[1])}
          </li>
        );
        return;
      }

      const numMatch = line.match(/^\d+\.\s+(.+)/);
      if (numMatch) {
        if (listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(
          <li key={`li-${i}`} className="text-sm">
            {renderInline(numMatch[1])}
          </li>
        );
        return;
      }

      flushList();

      if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
        return;
      }

      elements.push(
        <p key={i} className="text-sm leading-relaxed">
          {renderInline(line)}
        </p>
      );
    });

    flushList();
    return elements;
  };

  return <div className="chat-markdown">{renderMarkdown(content)}</div>;
};

export default ChatMarkdownRenderer;
