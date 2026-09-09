import { createRoot } from '@wordpress/element';
import App from './components/MapProvider';
import { PublicApp } from './components/MapProvider';
import BranchFinder from './components/BranchFinder';

const mapContainer           = document.getElementById('vos-territory');
const publicContainer        = document.getElementById('vos-territory-public');
const branchFinderContainers = document.querySelectorAll('.vos-branch-finder');

/**
 * renders the admin side map
 * or
 * renders the public side map
 */
if (mapContainer) {

    const mapRoot = createRoot(mapContainer);
    mapRoot.render(<App />);

} else if (publicContainer) {

    const publicRoot = createRoot(publicContainer);
    publicRoot.render(<PublicApp />);

}

// The Branch Finder block can appear independently — and more than once — on
// a page, so mount on every matching container rather than a single ID.
branchFinderContainers.forEach( ( el ) => {
    createRoot( el ).render( <BranchFinder /> );
} );
