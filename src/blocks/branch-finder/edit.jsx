import { useBlockProps } from '@wordpress/block-editor';

const Edit = () => {

    const blockProps = useBlockProps( {
        style: {
            background:     '#f6f7f7',
            border:         '1px dashed #949494',
            borderRadius:   '2px',
            padding:        '1.5rem',
            textAlign:      'center',
            color:          '#646970',
            userSelect:     'none',
        },
    } );

    return (
        <div { ...blockProps }>
            <strong style={ { fontSize: '0.9rem' } }>Branch Finder</strong>
            <div style={ { fontSize: '0.8rem', marginTop: '0.25rem' } }>
                Rendered on the frontend
            </div>
        </div>
    );

};

export default Edit;
