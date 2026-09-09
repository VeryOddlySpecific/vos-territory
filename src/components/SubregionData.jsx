import {
    Card,
    CardHeader,
    CardBody,
    CardDivider,
    ToggleControl,
    SelectControl,
    TextControl,
    Button,
    ButtonGroup,
    __experimentalHeading as Heading,
} from '@wordpress/components';

import { MapContext } from './MapContext';
import SaveButton from './SaveButton';
import PrintButton from './PrintButton';
import ExportButton from './ExportButton';
import ExcelExportButton from './ExcelExportButton';
//import GetCities from './GetCities';

import {
    useContext,
    useState,
    useEffect,
} from '@wordpress/element';

import { branchStyle } from '../utils/branchStyles';

const SubregionData = () => {

    const {
        mapRef,
        branches,
        playgrounds,
        viewMode,
        activeSelection,
        setActiveSelection,
        activeSubregions,
        setActiveSubregions,
        activePlaygroundSelection,
        setActivePlaygroundSelection,
        activePlaygroundSubregions,
        setActivePlaygroundSubregions,
    } = useContext(MapContext);

    // Mode-aware bindings so the panel edits the branch layer or the playground
    // layer depending on the active view. Branch behavior is unchanged when
    // viewMode === 'branches' (the default).
    const isPlayground      = viewMode === 'playgrounds';
    const entities          = isPlayground ? playgrounds : branches;
    const assignKey         = isPlayground ? 'playground' : 'branch';
    const selection         = isPlayground ? activePlaygroundSelection : activeSelection;
    const setSelection      = isPlayground ? setActivePlaygroundSelection : setActiveSelection;
    const activeSet         = isPlayground ? activePlaygroundSubregions : activeSubregions;
    const setActiveSet      = isPlayground ? setActivePlaygroundSubregions : setActiveSubregions;
    const restrictFlagKey   = isPlayground ? 'playgroundRestrictions' : 'restrictions';
    const restrictDetailKey = isPlayground ? 'playgroundRestrictionDetails' : 'restrictionDetails';

    const getBranchOptions = () => {
        const branchOptions = [{
            label: isPlayground ? 'Select playground' : 'Select branch',
            value: null,
        }];

        Object.keys(entities).forEach(key => {
            branchOptions.push({
                label: entities[key].label,
                value: key,
            });
        });

        return branchOptions;
    };

    const [active, setActive] = useState(false);
    const [hasRestrictions, setHasRestrictions] = useState(false);
    const [restrictionDetails, setRestrictionDetails] = useState(null);
    const [branchSelected, setBranchSelected] = useState(false);
    const [branchSelection, setBranchSelection] = useState(null);
    // Recompute each render so the dropdown reflects the current view mode.
    const branchOptions = getBranchOptions();

    const handleBranchSelect = (val) => {
        const styleToSet = branchStyle(entities[val]?.color);
        const updatedActiveSelection = selection.map(subregion => {
            subregion[assignKey] = val;
            return subregion;
        });

        updatedActiveSelection.forEach(subregion => {
            subregion.setStyle(styleToSet);
        });

        const updatedActiveSubregions = [...new Set([...activeSet, ...updatedActiveSelection])];

        setActiveSet(updatedActiveSubregions);
        setSelection([]);
        setActive(false);
    }

    const handlePrint = () => {

        console.log("print button clicked");

        // fetch geoJson data for all activeRegions and activeSubregions
        // process geoJson data into a vector format, adding styles as needed
        // combine all vector data into a single vector
        // create svg element from combined vector
        // download svg element as file

    }

    const handleClearSelection = () => {
        selection.forEach(subregion => {
            if (subregion[assignKey]) {
                subregion.setStyle(branchStyle(entities[subregion[assignKey]]?.color));
            } else {
                subregion.setStyle({
                    color: '#0a1944',
                    weight: 1,
                    opacity: .25,
                    fillColor: '#fff',
                    fillOpacity: 0.25,
                });
            }
        });
        setSelection([]);
        setActive(false);
    }

    const handleToggle = () => {
        setActive(!active);
    }

    const handleRestrictionToggle = () => {
        setHasRestrictions(!hasRestrictions);
    }

    const updateRestrictionDetails = (val) => {
        // for all in the current selection, set restrictions to true and add val to details
        selection.forEach(subregion => {
            subregion.options[restrictFlagKey] = true;
            subregion.options[restrictDetailKey] = val;
        });
    }

    useEffect(() => {

        if (hasRestrictions && selection.length) {
            console.log("adding 'restrictions' to the current selection")

            selection.forEach(subregion => {
                subregion.setStyle({
                    color: '#f00'
                })
                console.log("Adding restrictions = true to subregion options")
                subregion.options[restrictFlagKey] = true;
            })
            // set the style of the activeSelection to the 'restrictions' style
            // restrictions style should be a diagonal hash pattern with a red color
            // create an svg pattern with diagonal lines
            // var gradientColor = '#f00';
            // activeSelection.forEach(subregion => {
            //     console.log("subregion: ", subregion)
            //     let currentFillColor = subregion.options.fill;
            //     let oldStyle = subregion.options.style;
            //     let gradientCSS = 'liner-gradient(45deg, ' + gradientColor + ' 25%, ' + currentFillColor + ' 25%)';
            //     subregion.setStyle({
            //         fillColor: gradientCSS
            //     })
            //     console.log("subregion style updated from: ", oldStyle, "to: ", subregion.options.style)
            // });

        }
    }, [hasRestrictions])

    useEffect(() => {
        if (branchSelection && branchSelected) {
            const styleToSet = branchStyle(entities[branchSelection]?.color);
            const updatedActiveSelection = selection.map(subregion => {
                subregion[assignKey] = branchSelection;
                return subregion;
            });

            updatedActiveSelection.forEach(subregion => {
                subregion.setStyle(styleToSet);
            });

            const updatedActiveSubregions = [...new Set([...activeSet, ...updatedActiveSelection])];

            setActiveSet(updatedActiveSubregions);
            setSelection([]);
        }
    }, [branchSelection])

    useEffect(() => {
        // Are all items in the current selection assigned to the same entity?
        // If so, surface that entity in the assignment UI; otherwise reset it.
        if (selection.length) {

            const selectedHaveEntity = selection.every(subregion => subregion[assignKey]);

            if (selectedHaveEntity) {
                const selectedHaveSameEntity = selection.every(subregion => subregion[assignKey] === selection[0][assignKey]);

                if (selectedHaveSameEntity) {
                    setActive(true);
                    setBranchSelection(selection[0][assignKey]);

                    // If every selected county carries a restriction, reflect it
                    // (and the first one's details) in the restriction controls.
                    const selectedHaveRestrictions = selection.every(subregion => subregion.options[restrictFlagKey]);
                    if (selectedHaveRestrictions) {
                        setHasRestrictions(true);
                        setRestrictionDetails(selection[0].options[restrictDetailKey]);
                    }
                } else {
                    setActive(false);
                    setBranchSelection(null);
                }
            } else {
                setActive(false);
                setBranchSelection(null);
            }
        } else {
            setActive(false);
            setBranchSelection(null);
        }

    }, [selection])

    /**
     * UseEffect to process selection on activeChange, when active become false
     */
    useEffect(() => {

        // if active has become false, remove counties in the selection from the
        // active set and clear their styles.
        if ( !active ) {
            let deactiveatedSubregions = activeSet.filter(subregion => {
                return selection.includes(subregion);
            });
            let updatedActiveSubregions = activeSet.filter(subregion => {
                return !selection.includes(subregion);
            });

            // remove styles from deactiveatedSubregions
            deactiveatedSubregions.forEach(subregion => {
                subregion.setStyle({
                    color: '#0a1944',
                    weight: 1,
                    opacity: .25,
                    fillColor: '#fff',
                    fillOpacity: 0.25,
                });
            });

            setActiveSet(updatedActiveSubregions);

            setSelection([]);
        }

    }, [active])

    return (

        <Card>
            <CardHeader>
                <Heading level={3}>Subregion Data</Heading>
            </CardHeader>
            <CardBody>
                <ButtonGroup
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gridGap: '2rem',
                    }}
                >
                    <Button
                        isSecondary
                        onClick={handleClearSelection}
                    >Clear Selection</Button>
                    <SaveButton />
                    <PrintButton />
                    <ExportButton />
                    <ExcelExportButton />
                </ButtonGroup>
                <CardDivider 
                    style={{
                        margin: '1rem 0'
                    }}
                />
                <ToggleControl
                    label="Activate counties"
                    checked={ active }
                    onChange={handleToggle}
                />
                <SelectControl
                    label={ isPlayground ? "Select playground" : "Select branch" }
                    disabled={ !active }
                    options={ branchOptions }
                    value={ branchSelection }
                    onChange={handleBranchSelect}
                />
                <CardDivider />
                <Heading level={4}>Selected Counties:</Heading>
                <ul>
                {

                    selection.length > 0 ? (
                        
                        selection.map( subregion => {
                            
                            return (
                                <li>
                                <Heading 
                                    level={5}
                                    key={subregion.feature.properties.GEOID}
                                    >{subregion.feature.properties.Name} County
                                </Heading>
                                </li>
                            )
                        
                        })
                        
                        
                    ) : (
                        
                        <></>

                    )
                    
                }
                </ul>
                <CardDivider />
                <Heading level={4}>County Restrictions:</Heading>
                <ToggleControl 
                    label="Has restrictions"
                    checked={hasRestrictions}
                    onChange={handleRestrictionToggle}
                />
                <TextControl
                    label="Restriction details"
                    onChange={updateRestrictionDetails}
                    value={restrictionDetails}
                />
                

            </CardBody>

        </Card>

    )

}

export default SubregionData;