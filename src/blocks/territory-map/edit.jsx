import { useBlockProps } from '@wordpress/block-editor';

/**
 * Editor view of the Territory Map block.
 * Renders a placeholder — the live map is server-rendered on the frontend.
 */
const Edit = () => {

    const blockProps = useBlockProps( {
        style: {
            background:     '#f6f7f7',
            border:         '1px dashed #949494',
            borderRadius:   '2px',
            padding:        '2rem',
            textAlign:      'center',
            minHeight:      '160px',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '0.5rem',
            color:          '#646970',
            userSelect:     'none',
        },
    } );

    return (
        <div { ...blockProps }>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            <strong style={ { fontSize: '0.9rem' } }>Territory Map</strong>
            <span style={ { fontSize: '0.8rem' } }>Rendered on the frontend</span>
        </div>
    );

};

export default Edit;
