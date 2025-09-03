import { forwardRef, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import '../../styles/quill-custom.css';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

const RichTextEditor = forwardRef<ReactQuill, RichTextEditorProps>(
  ({ value = '', onChange, placeholder, readOnly = false, className = '' }, ref) => {
    const quillRef = useRef<ReactQuill>(null);

    // Merge external ref with internal ref
    useEffect(() => {
      if (ref && quillRef.current) {
        if (typeof ref === 'function') {
          ref(quillRef.current);
        } else {
          ref.current = quillRef.current;
        }
      }
    }, [ref]);

    const modules = {
      toolbar: {
        container: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'align': [] }],
          ['link'],
          ['clean']
        ],
      },
      clipboard: {
        matchVisual: false,
      }
    };

    const formats = [
      'header',
      'bold', 'italic', 'underline', 'strike',
      'color', 'background',
      'list', 'bullet',
      'align',
      'link'
    ];

    const handleChange = (content: string, delta: any, source: any, editor: any) => {
      if (onChange) {
        // Get HTML content
        const html = editor.getHTML();
        onChange(html);
      }
    };

    return (
      <div className={`rich-text-editor ${className}`}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          readOnly={readOnly}
          modules={modules}
          formats={formats}
        />
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;