import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators';
import { Router } from '@vaadin/router';

import './app-home';
import '../components/header';
import '../components/footer';

import { SizeMax } from '../common/constants';

@customElement('app-index')
export class AppIndex extends LitElement {
  static get styles() {
    return css`
      main {
        padding: 16px;
      }

      @media (max-width: ${SizeMax.Md}px) {
        main {
          padding-top: 0;
          margin-top: 30px;
        }
      }

      #routerOutlet > * {
        width: 100% !important;
      }

      #routerOutlet > .leaving {
        animation: 160ms fadeOut ease-in-out;
      }

      #routerOutlet > .entering {
        animation: 160ms fadeIn linear;
      }

      @keyframes fadeOut {
        from {
          opacity: 1;
        }

        to {
          opacity: 0;
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0.2;
        }

        to {
          opacity: 1;
        }
      }
    `;
  }

  constructor() {
    super();
  }

  firstUpdated() {
    // For more info on using the @vaadin/router check here https://vaadin.com/router
    const router = new Router(this.shadowRoot?.querySelector('#routerOutlet'));
    router.setRoutes([
      // temporarily cast to any because of a Type bug with the router
      {
        path: '',
        animate: true,
        children: [
          { path: '/', component: 'app-home' },
          { path: '/chordsheets/:id', component: 'chord-details', action: async () => await import("./chord-details") },
          { path: '/browse/newest', component: 'browse-newest', action: async () => await import("./browse-newest") },
          { path: '/browse/songs', component: 'browse-songs', action: async () => await import("./browse-songs") },
          { path: '/browse/artists', component: 'browse-artists', action: async () => await import("./browse-artists") },
          { path: '/browse/random', component: 'browse-random', action: async () => await import("./browse-random") },
          { path: '/artist/:name', component: 'artist-songs', action: async () => await import("./artist-songs") },
          { path: '/about', component: 'app-about', action: async () => await import("./app-about") }
        ],
      } as any,
    ]);
  }

  render() {
    return html`
      <div>
        <app-header></app-header>
      
        <main>
          <div id="routerOutlet"></div>
        </main>
      
        <app-footer></app-footer>
      </div>
    `;
  }
}