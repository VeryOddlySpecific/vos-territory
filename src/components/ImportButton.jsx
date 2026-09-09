import { Button } from '@wordpress/components';
import { useContext, useState, useRef } from '@wordpress/element';
import { MapContext } from './MapContext';

/**
 * Imports branch/county assignments from a JSON file.
 *
 * Expected file shape:
 * [
 *   {
 *     "location": "La Vista, Nebraska",   // matched against existing branch labels
 *     "name": "Corporate Office",         // used as title if branch must be created
 *     "subregions": ["31001", "31003"]    // county GEOIDs
 *   },
 *   ...
 * ]
 *
 * For each item:
 *  - If a branch with a matching label (location) already exists, use it.
 *  - Otherwise create a new vos_branch post via the WP REST API.
 * Then hands off to MapProcessor via importPayload to load states + assign counties.
 */
const ImportButton = () => {

    const { branches, setBranches, setImportPayload } = useContext( MapContext );

    const [ isImporting, setIsImporting ] = useState( false );
    const [ error, setError ]             = useState( null );
    const fileInputRef                    = useRef();

    const createBranch = async ( location, name ) => {
        const response = await fetch( vosTm.restUrl + 'wp/v2/vos_branch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce':   vosTm.nonce,
            },
            body: JSON.stringify( {
                title:  location,
                status: 'publish',
                meta: {
                    // Assign a neutral placeholder color; user can update in the branch editor.
                    _vos_branch_color: '#888888',
                },
            } ),
        } );

        if ( ! response.ok ) {
            const body = await response.json().catch( () => ({}) );
            throw new Error( `Failed to create branch "${ location }": ${ body.message ?? response.status }` );
        }

        return response.json();
    };

    const handleFileChange = async ( e ) => {
        const file = e.target.files[0];
        if ( ! file ) return;

        setIsImporting( true );
        setError( null );

        try {
            // Parse the JSON file.
            const text = await file.text();
            let data;
            try {
                data = JSON.parse( text );
            } catch {
                throw new Error( 'Invalid JSON file.' );
            }

            if ( ! Array.isArray( data ) ) {
                throw new Error( 'Expected a JSON array at the top level.' );
            }

            // Build an updated branches map and a flat list of GEOID → branchId assignments.
            // Do all async work first, then dispatch both state updates together so
            // MapProcessor sees the updated branches when it processes the payload.
            const branchUpdates = { ...branches };
            const assignments   = [];

            for ( const item of data ) {
                const location = item.location?.trim();
                const name     = item.name?.trim();
                const geoids   = Array.isArray( item.subregions ) ? item.subregions : [];

                if ( ! location ) {
                    console.warn( 'Import: skipping item with no "location" field', item );
                    continue;
                }

                // Find an existing branch by label match.
                const existingEntry = Object.entries( branchUpdates ).find(
                    ( [, b] ) => b.label?.toLowerCase() === location.toLowerCase()
                );

                let branchId;

                if ( existingEntry ) {
                    branchId = existingEntry[0];
                } else {
                    // Create a new branch post.
                    const newPost = await createBranch( location, name );
                    branchId = String( newPost.id );
                    branchUpdates[ branchId ] = {
                        id:          newPost.id,
                        label:       location,
                        color:       '#888888',
                        coordinates: null,
                        url:         '',
                    };
                }

                geoids.forEach( geoid => {
                    assignments.push( { geoid: String( geoid ), branchId } );
                } );
            }

            if ( ! assignments.length ) {
                throw new Error( 'No county assignments found in the file.' );
            }

            // Dispatch both updates consecutively so React 18 batches them.
            // MapProcessor's importPayload effect will see the updated branches.
            setBranches( branchUpdates );
            setImportPayload( { assignments } );

        } catch ( err ) {
            console.error( 'Import error:', err );
            setError( err.message );
        } finally {
            setIsImporting( false );
            // Reset the input so the same file can be re-selected if needed.
            fileInputRef.current.value = '';
        }
    };

    return (
        <div>
            <input
                ref={ fileInputRef }
                type="file"
                accept=".json,application/json"
                style={ { display: 'none' } }
                onChange={ handleFileChange }
            />
            <Button
                variant="secondary"
                onClick={ () => fileInputRef.current.click() }
                isBusy={ isImporting }
                disabled={ isImporting }
            >
                { isImporting ? 'Importing…' : 'Import JSON' }
            </Button>
            { error && (
                <p style={ { color: '#cc1818', fontSize: '0.8rem', margin: '0.4rem 0 0' } }>
                    { error }
                </p>
            ) }
        </div>
    );

};

export default ImportButton;
