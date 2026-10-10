import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { DialogHost } from './components/ui/Dialogs';
import { setupOverlayExitAnimations } from './components/ui/overlayExit';
import './index.css';
import { setupPwa } from './pwa';

setupPwa();
setupOverlayExitAnimations();

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <DialogHost />
  </>,
);
