import { MapProvider } from './MapContext';
import Layout from './Layout';
import { PublicLayout } from './Layout';

/**
 * returns the admin side map, wrapped in the MapProvider
 * MapProvider is used to provide the map context to the components
 * 
 * @returns {JSX.Element}
 */
function App() {
  return (
    <MapProvider>
      <Layout />
    </MapProvider>
  );
}

/**
 * returns the public side map, wrapped in the MapProvider
 * MapProvider is used to provide the map context to the components
 * 
 * @returns {JSX.Element}
 */
function PublicApp() {
  return (
    <MapProvider>
      <PublicLayout />
    </MapProvider>
  );
}

export default App;

export { PublicApp };