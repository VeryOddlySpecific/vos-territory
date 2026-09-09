import geojson
import os

# get all files in current directory with extention .geojson
fileList = os.listdir()
geojsonFiles = [file for file in fileList if file.endswith(".geojson")]

def filterGeometry(geometry):
    newGeometry = {
        "type": geometry["type"],
        "coordinates": []
    }

    for coordinate in geometry["coordinates"][0]:
        newCoordinate = [coordinate[0], coordinate[1]]
        newGeometry["coordinates"].append(newCoordinate)

    return newGeometry

# loop through all geojson files
# filter geometry
# then save to new geojson file
for file in geojsonFiles:
    newFileName = "filtered/" + file.split(".")[0] + "_filtered.geojson"
    with open(file) as f:
        geojsonData = geojson.load(f)

        features = geojsonData["features"]

        newFeatureCollection = {
            "type": "FeatureCollection",
            "features": []
        }

        for feature in features:
            
            # if feature does not have properties, skip
            if len(feature["properties"]) == 0:
                continue

            # if feature["properties"] has a key of "Name", change it to "name"
            if "Name" in feature["properties"]:
                feature["properties"]["name"] = feature["properties"]["Name"]
                del feature["properties"]["Name"]

            newFeature = {
                "type": "Feature",
                "properties": {
                    "name": feature["properties"]["name"],
                    "STATEFP": feature["properties"]["STATEFP"],
                    "GEOID": feature["properties"]["GEOID"]
                },
                "geometry": filterGeometry(feature["geometry"])
            }

            newFeatureCollection["features"].append(newFeature)

    with open(newFileName, "w") as f:
        geojson.dump(newFeatureCollection, f)


newFeatureCollection = {
    "type": "FeatureCollection",
    "features": []
}