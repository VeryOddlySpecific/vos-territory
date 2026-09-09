import {
    createContext,
    useState,
    useRef,
} from "@wordpress/element";

export const MapContext = createContext();

export const MapProvider = ({ children }) => {

    const [activeRegions, setActiveRegions] = useState([]);
    const [activeSubregions, setActiveSubregions] = useState([]);
    const [activeSelection, setActiveSelection] = useState([]);
    const [legendKeyClicked, setLegendKeyClicked] = useState(null);
    const [toggledRegion, setToggledRegion] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    // Branch data is passed from PHP via wp_localize_script as vosTm.branches,
    // keyed by post ID string. Each entry: { id, label, color, coordinates, url }
    const [branches] = useState(
        (typeof vosTm !== 'undefined' && vosTm.branches) ? vosTm.branches : {}
    );

    // Playgrounds are an independent territory category (same shape as branches,
    // keyed by vos_playground post ID) rendered when viewMode === 'playgrounds'.
    const [playgrounds] = useState(
        (typeof vosTm !== 'undefined' && vosTm.playgrounds) ? vosTm.playgrounds : {}
    );

    // Which territory layer the map + legend currently show/edit. Defaults to
    // 'branches' so existing behavior is unchanged when no playgrounds exist.
    const [viewMode, setViewMode] = useState('branches');

    // Parallel active-layer / selection arrays for the playground layer,
    // mirroring activeSubregions / activeSelection for branches. A county layer
    // can appear in both sets (a county may belong to a branch AND a playground).
    const [activePlaygroundSubregions, setActivePlaygroundSubregions] = useState([]);
    const [activePlaygroundSelection, setActivePlaygroundSelection] = useState([]);

    const mapRef = useRef();

    // Shared ref for all rendered county layers. MapProcessor populates this so
    // CountySearch (and any other consumer) can iterate over loaded counties
    // without needing its own parallel data structure.
    const countyLayersRef = useRef([]);

    return (
        <MapContext.Provider value={{
            mapRef,
            countyLayersRef,
            branches,
            playgrounds,
            viewMode,
            setViewMode,
            activeRegions,
            setActiveRegions,
            activeSubregions,
            setActiveSubregions,
            activeSelection,
            setActiveSelection,
            activePlaygroundSubregions,
            setActivePlaygroundSubregions,
            activePlaygroundSelection,
            setActivePlaygroundSelection,
            toggledRegion,
            setToggledRegion,
            legendKeyClicked,
            setLegendKeyClicked,
            isLoading,
            setIsLoading,
        }}>
            {children}
        </MapContext.Provider>
    )

}
