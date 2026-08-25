import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const DEBOUNCE_MS = 1000;

/** Returns { current, previous } paragraph text around the cursor. */
function getParagraphsAroundCursor(editor) {
  if (!editor) return { current: '', previous: '' };
  const { state } = editor;
  const { $from } = state.selection;

  const paragraphs = [];
  let currentIndex = -1;

  state.doc.forEach((node, offset) => {
    if (node.isTextblock) {
      const text = node.textContent;
      const start = offset;
      const end = offset + node.nodeSize;
      paragraphs.push(text);
      if ($from.pos >= start && $from.pos <= end) {
        currentIndex = paragraphs.length - 1;
      }
    }
  });

  if (currentIndex === -1) currentIndex = paragraphs.length - 1;

  return {
    current: paragraphs[currentIndex] || '',
    previous: currentIndex > 0 ? paragraphs[currentIndex - 1] : '',
  };
}

function Toolbar({ editor }) {
  if (!editor) return null;

  return (
    <div className="editor-toolbar">
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
          title="Bold (Ctrl+B)"
        >
          <b>B</b>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
          title="Italic (Ctrl+I)"
        >
          <i>I</i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? 'is-active' : ''}
          title="Inline Code"
        >
          <code>&lt;/&gt;</code>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
          title="Heading 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={editor.isActive('paragraph') ? 'is-active' : ''}
          title="Paragraph"
        >
          P
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          title="Bullet List"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
          title="Numbered List"
        >
          1. List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'is-active' : ''}
          title="Blockquote"
        >
          ” Quote
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'is-active' : ''}
          title="Code Block"
        >
          &#123; &#125;
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Line"
        >
          ―
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Clear Formatting"
        >
          Clear
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="Redo (Ctrl+Y)"
        >
          ↷
        </button>
      </div>
    </div>
  );
}

function IllustrationCard({ item, index, onOpenLightbox }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const getPerspectiveIcon = (idx) => {
    switch (idx) {
      case 0:
        return '🌐';
      case 1:
        return '👤';
      case 2:
        return '✨';
      default:
        return '🎨';
    }
  };

  const handleCopyPrompt = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(item.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ai-image-card">
      <div className="ai-card-header">
        <div className="perspective-badge">
          <span className="perspective-icon">{getPerspectiveIcon(index)}</span>
          <span className="perspective-title">{item.perspective || `Angle ${index + 1}`}</span>
        </div>
        <span className="image-number">#{index + 1} of 3</span>
      </div>

      <div className="ai-image-wrapper" onClick={() => onOpenLightbox(item)}>
        {!imgLoaded && <div className="image-shimmer" />}
        <img
          src={item.url}
          alt={item.prompt}
          loading="lazy"
          className={imgLoaded ? 'loaded' : 'loading'}
          onLoad={() => setImgLoaded(true)}
        />
        <div className="image-overlay-actions">
          <button
            type="button"
            className="action-btn"
            title="View full image"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLightbox(item);
            }}
          >
            🔍 Expand
          </button>
          <button
            type="button"
            className="action-btn"
            title="Copy prompt"
            onClick={handleCopyPrompt}
          >
            {copied ? '✓ Copied' : '📋 Copy Prompt'}
          </button>
        </div>
      </div>

      <div className="ai-card-body">
        <div className="prompt-header" onClick={() => setShowPrompt(!showPrompt)}>
          <span className="prompt-label">AI Generation Prompt</span>
          <span className="toggle-indicator">{showPrompt ? '▲ Hide' : '▼ View'}</span>
        </div>

        {showPrompt ? (
          <p className="prompt-text expanded">{item.prompt}</p>
        ) : (
          <p className="prompt-text collapsed">{item.prompt}</p>
        )}

        <div className="card-footer-meta">
          <span className="provider-tag">{item.provider || 'AI Generated'}</span>
          {item.seed && <span className="seed-tag">Seed: {item.seed}</span>}
        </div>
      </div>
    </div>
  );
}

function LightboxModal({ image, onClose }) {
  if (!image) return null;

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="lightbox-header">
          <div>
            <h3>{image.perspective || 'AI Illustration'}</h3>
            <span className="lightbox-provider">{image.provider}</span>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="lightbox-image-container">
          <img src={image.url} alt={image.prompt} />
        </div>

        <div className="lightbox-caption">
          <strong>Prompt:</strong> {image.prompt}
        </div>

        <footer className="lightbox-footer">
          <a
            href={image.url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            download="storyvision-illustration.jpg"
          >
            ↗ Open in New Tab
          </a>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const [keywords, setKeywords] = useState(null);
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [leftWidth, setLeftWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [activeImage, setActiveImage] = useState(null);

  const splitRef = useRef(null);
  const debounceTimer = useRef(null);
  const requestSeq = useRef(0);
  const currentParagraphsRef = useRef({ current: '', previous: '' });

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const newWidthPx = e.clientX - rect.left;
      const newPercent = (newWidthPx / rect.width) * 100;
      const clamped = Math.max(20, Math.min(80, newPercent));
      setLeftWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const runSceneGeneration = useCallback(async (current, previous, forceRegenerate = false) => {
    if (!current || !current.trim()) {
      setStatus('idle');
      setKeywords(null);
      setImages([]);
      return;
    }

    const seq = ++requestSeq.current;
    setStatus('generating');
    setErrorMsg('');

    try {
      const res = await fetch('/api/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: current,
          previousText: previous,
          regenerate: forceRegenerate,
        }),
      });

      if (seq !== requestSeq.current) return;

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setKeywords(data.keywords || null);
      setImages(data.images || []);
      setStatus('done');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setStatus('error');
      setErrorMsg(err.message || 'Image generation failed');
    }
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Sarah walked through the snowy forest, holding an old lantern as strange golden particles danced between the frozen pines.</p>',
    onUpdate: ({ editor }) => {
      setStatus('typing');
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const { current, previous } = getParagraphsAroundCursor(editor);
        currentParagraphsRef.current = { current, previous };
        runSceneGeneration(current, previous);
      }, DEBOUNCE_MS);
    },
    onSelectionUpdate: ({ editor }) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const { current, previous } = getParagraphsAroundCursor(editor);
        currentParagraphsRef.current = { current, previous };
        runSceneGeneration(current, previous);
      }, DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const { current, previous } = getParagraphsAroundCursor(editor);
    currentParagraphsRef.current = { current, previous };
    runSceneGeneration(current, previous);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const handleRegenerateCurrent = () => {
    const { current, previous } = currentParagraphsRef.current;
    if (current && current.trim()) {
      runSceneGeneration(current, previous, true);
    }
  };

  return (
    <div className={`app ${isResizing ? 'is-resizing' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◈</span> StoryVision <span className="version-tag">v2 AI</span>
        </div>
        <div className="topbar-center">
          <span className="mode-label">3-Perspective Live AI Storyboard</span>
        </div>
        <div className="topbar-right">
          <div className={`status status-${status}`}>
            {status === 'typing' && 'Writing…'}
            {status === 'generating' && '🎨 Generating 3 AI illustrations…'}
            {status === 'done' && '✓ 3 Illustrations ready'}
            {status === 'error' && `Error: ${errorMsg}`}
            {status === 'idle' && 'Start writing a paragraph'}
          </div>
          {status === 'done' && (
            <button
              type="button"
              className="refresh-btn"
              onClick={handleRegenerateCurrent}
              title="Regenerate all 3 images with new seeds"
            >
              🔄 Re-roll 3 Images
            </button>
          )}
        </div>
      </header>

      <main className="split" ref={splitRef}>
        <section className="editor-pane" style={{ width: `${leftWidth}%` }}>
          <Toolbar editor={editor} />
          <EditorContent editor={editor} className="editor" />
        </section>

        <div
          className={`resizer ${isResizing ? 'active' : ''}`}
          onMouseDown={handleMouseDown}
          title="Drag to resize panels"
        >
          <div className="resizer-line" />
        </div>

        <aside className="visual-pane" style={{ width: `${100 - leftWidth}%` }}>
          <div className="panel-header">
            <div>
              <h2 className="panel-title">AI Storyboard (3 Illustrations)</h2>
              <p className="panel-subtitle">
                Illustrating the current active paragraph across 3 cinematic perspectives
              </p>
            </div>
          </div>

          {keywords && (
            <div className="keyword-strip">
              {keywords.main_subject && (
                <span className="chip chip-primary">👤 {keywords.main_subject}</span>
              )}
              {keywords.environment && (
                <span className="chip chip-accent">🌲 {keywords.environment}</span>
              )}
              {keywords.mood && (
                <span className="chip chip-mood">🎭 {keywords.mood}</span>
              )}
              {(keywords.objects || []).map((obj) => (
                <span className="chip" key={obj}>
                  ✦ {obj}
                </span>
              ))}
            </div>
          )}

          {status === 'generating' && (
            <div className="generating-state">
              <div className="generating-header">
                <div className="spinner" />
                <span>Synthesizing 3 AI illustrations for your paragraph...</span>
              </div>
              <div className="skeleton-grid">
                <div className="skeleton-card">
                  <div className="skeleton-badge">🌐 Establishing Wide Shot</div>
                  <div className="skeleton-media shimmer" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line shimmer" />
                    <div className="skeleton-line short shimmer" />
                  </div>
                </div>
                <div className="skeleton-card">
                  <div className="skeleton-badge">👤 Character & Action Focus</div>
                  <div className="skeleton-media shimmer" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line shimmer" />
                    <div className="skeleton-line short shimmer" />
                  </div>
                </div>
                <div className="skeleton-card">
                  <div className="skeleton-badge">✨ Atmospheric Detail & Mood</div>
                  <div className="skeleton-media shimmer" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line shimmer" />
                    <div className="skeleton-line short shimmer" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {images.length === 0 && status !== 'generating' && status !== 'typing' && (
            <div className="empty-state">
              <div className="empty-icon">🎨</div>
              <h3>No illustrations generated yet</h3>
              <p className="empty-sub">
                Type a narrative paragraph in the editor. Once you pause, StoryVision will generate 3
                cohesive AI illustrations capturing the setting, character interaction, and mood.
              </p>
            </div>
          )}

          {images.length > 0 && status !== 'generating' && (
            <div className="illustrations-container">
              {images.map((item, idx) => (
                <IllustrationCard
                  key={item.id || idx}
                  item={item}
                  index={idx}
                  onOpenLightbox={setActiveImage}
                />
              ))}
            </div>
          )}
        </aside>
      </main>

      {activeImage && (
        <LightboxModal image={activeImage} onClose={() => setActiveImage(null)} />
      )}
    </div>
  );
}
