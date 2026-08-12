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

function MediaCard({ item }) {
  return (
    <a className="media-card" href={item.pageUrl} target="_blank" rel="noreferrer">
      {item.type === 'video' ? (
        <div className="media-thumb video">
          <img src={item.thumb} alt={item.alt} loading="lazy" />
          <span className="play-badge">▶</span>
        </div>
      ) : (
        <div className="media-thumb">
          <img src={item.thumb} alt={item.alt} loading="lazy" />
        </div>
      )}
      <div className="media-meta">
        <span className="provider">{item.provider}</span>
        {item.credit && <span className="credit">{item.credit}</span>}
      </div>
    </a>
  );
}

export default function App() {
  const [keywords, setKeywords] = useState(null);
  const [media, setMedia] = useState({ images: [], videos: [] });
  const [status, setStatus] = useState('idle'); // idle | typing | analyzing | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [leftWidth, setLeftWidth] = useState(50); // percentage 20 - 80
  const [isResizing, setIsResizing] = useState(false);

  const splitRef = useRef(null);
  const debounceTimer = useRef(null);
  const requestSeq = useRef(0);
  const lastEnvironmentRef = useRef(''); // hook for future scene-change detection

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

  const runSceneAnalysis = useCallback(async (current, previous) => {
    if (!current || !current.trim()) {
      setStatus('idle');
      setKeywords(null);
      setMedia({ images: [], videos: [] });
      return;
    }

    const seq = ++requestSeq.current;
    setStatus('analyzing');
    setErrorMsg('');

    try {
      const res = await fetch('/api/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: current, previousText: previous }),
      });

      if (seq !== requestSeq.current) return; // a newer request superseded this one

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      lastEnvironmentRef.current = data.keywords?.environment || '';
      setKeywords(data.keywords || null);
      setMedia(data.media || { images: [], videos: [] });
      setStatus('done');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong');
    }
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Sarah walked through the snowy forest, holding an old lantern.</p>',
    onUpdate: ({ editor }) => {
      setStatus('typing');
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const { current, previous } = getParagraphsAroundCursor(editor);
        runSceneAnalysis(current, previous);
      }, DEBOUNCE_MS);
    },
    onSelectionUpdate: ({ editor }) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const { current, previous } = getParagraphsAroundCursor(editor);
        runSceneAnalysis(current, previous);
      }, DEBOUNCE_MS);
    },
  });

  // Run an initial analysis on load for the seed content.
  useEffect(() => {
    if (!editor) return;
    const { current, previous } = getParagraphsAroundCursor(editor);
    runSceneAnalysis(current, previous);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const allMedia = [...(media.images || []), ...(media.videos || [])];

  return (
    <div className={`app ${isResizing ? 'is-resizing' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◐</span> StoryVision
        </div>
        <div className={`status status-${status}`}>
          {status === 'typing' && 'Writing…'}
          {status === 'analyzing' && 'Reading the scene…'}
          {status === 'done' && 'Panel updated'}
          {status === 'error' && `Error: ${errorMsg}`}
          {status === 'idle' && 'Start writing'}
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
          {keywords?.search && (
            <div className="keyword-strip">
              <span className="chip chip-primary">{keywords.search}</span>
              {keywords.mood && <span className="chip">{keywords.mood}</span>}
              {(keywords.objects || []).slice(0, 3).map((o) => (
                <span className="chip" key={o}>{o}</span>
              ))}
            </div>
          )}

          {allMedia.length === 0 && status !== 'analyzing' && status !== 'typing' && (
            <div className="empty-state">
              <p>No matching media yet.</p>
              <p className="empty-sub">Keep writing — visuals appear as the scene takes shape.</p>
              <div className="placeholder-card">
                <div className="placeholder-art">✦</div>
                <span>Visual references will appear here once the scene is rich enough.</span>
              </div>
            </div>
          )}

          {status === 'analyzing' && allMedia.length === 0 && (
            <div className="empty-state">
              <p>Searching for visuals…</p>
            </div>
          )}

          <div className="media-grid">
            {allMedia.map((item) => (
              <MediaCard item={item} key={item.id} />
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
