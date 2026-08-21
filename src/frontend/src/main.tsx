import { render } from 'preact';
import type { JSX } from 'preact';
import './styles.css';
import { matchRoute, useRoute } from './router.tsx';
import { NotFound } from './components.tsx';
import { stringsFor } from './strings.ts';
import { Home } from './pages/Home.tsx';
import { Figure } from './pages/Figure.tsx';
import { Statement } from './pages/Statement.tsx';
import { Inconsistency } from './pages/Inconsistency.tsx';
import { Search } from './pages/Search.tsx';
import { Methodology } from './pages/Methodology.tsx';

function App(): JSX.Element {
  const route = useRoute();

  if (route.path === '/') return <Home />;
  if (route.path === '/search') return <Search query={route.query.get('q') ?? ''} />;
  if (route.path === '/methodology') return <Methodology />;

  const figure = matchRoute(route.path, '/figures');
  if (figure) return <Figure id={figure} />;

  const statement = matchRoute(route.path, '/statements');
  if (statement) return <Statement id={statement} />;

  const inconsistency = matchRoute(route.path, '/inconsistencies');
  if (inconsistency) return <Inconsistency id={inconsistency} />;

  return <NotFound strings={stringsFor('he')} />;
}

render(<App />, document.getElementById('app')!);
