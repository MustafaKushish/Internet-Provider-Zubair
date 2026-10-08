import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { DialogHost } from './components/ui/Dialogs';
import './index.css';
import { setupPwa } from './pwa';

setupPwa();

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <DialogHost />
  </>,
);
