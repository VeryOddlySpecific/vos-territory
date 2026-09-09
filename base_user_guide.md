# Information on how this Territory Map plugin works

## Display

When the admin page loads, this app will display a panel consisting of the following elements:
- Region Selector 
    - to select which regions/states are active
- Map Legend 
    - to show which branches there are 
    - to show what color the branch is
    - to allow the user to focus the view on a particular branch
- Subregion Data 
    - to allow the user to:
        - clear the active selection of subregions
        - save the map's current state to the database
        - print the map to a .png file
    - to allow the user to:
        - see a list of names of the currently selected counties
        - activate or deactivate those counties
        - assign selected counties to a particular branch
        - add restrictions to the selected counties
- Map Display
    - displays:
        - active regions
        - all subregions within active regions
        - altered styles for active subregions, and subregions with restrictions

## Feature requests

See [FEATURE-REQUESTS.md](FEATURE-REQUESTS.md) for the backlog and status of requested enhancements.