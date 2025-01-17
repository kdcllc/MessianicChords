import { RouterLocation } from "@vaadin/router";
import { html, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { BootstrapBase } from "../common/bootstrap-base";
import { ChordSheet } from "../models/interfaces";
import { ChordService } from "../services/chord-service";
import { repeat } from 'lit/directives/repeat.js';
import { ChordCache } from "../services/chord-cache";
import { ChordChartLine, ChordChartSpan, createChordChartLines } from "../models/chord-chart-line";
import { Chord } from "../models/chord";
import { chordDetailStyles } from "./chord-details.styles";

@customElement('chord-details')
export class ChordDetails extends BootstrapBase {
    static get styles() {
        return [BootstrapBase.styles, chordDetailStyles];
    }

    @state() chord: ChordSheet | null = null;
    @state() error: string | null = null;
    @state() canGoFullScreen: boolean | null = null;
    @state() isWebPublished = false;
    @state() hasScreenshots = false;
    @state() transpose: number = 0;

    location: RouterLocation | null = null;
    chordChartLines: ChordChartLine[] | null = null;
    readonly chordService = new ChordService();
    readonly chordCache = new ChordCache();

    constructor() {
        super();
    }

    firstUpdated() {
        this.canGoFullScreen = !!document.body.requestFullscreen;
        this.loadChordSheet()
            .then(result => this.chordSheetLoaded(result))
            .catch(error => this.chordSheetLoadFailed(error));
    }

    chordSheetLoaded(chord: ChordSheet) {
        if (chord == null) {
            this.chordSheetLoadFailed("Unable to load chord sheet. API return null for " + this.location?.params["id"]);
            return;
        }

        this.chord = chord;
        this.isWebPublished = !!chord.publishUri;
        this.hasScreenshots = chord.screenshots.length > 0;
        this.cacheChordForOfflineSearch(chord);
        const chordName = [
            chord.song,
            chord.hebrewSongName
        ]
            .filter(n => !!n)
            .join(" ");
        document.title = `${chordName} chords and lyrics on Messianic Chords`;

        // Offline helper: see if we have a offline index query string.
        // If so, fetch the next chord sheet in the list and load that in a moment.
        const queryParams = new URLSearchParams(this.location?.search || "");
        const offlineIndexStr = queryParams.get("offline-index") || "";
        const offlineIndex = parseFloat(offlineIndexStr);
        if (offlineIndex >= 0) {
            setTimeout(() => {
                this.chordService.getByOrderedIndex(offlineIndex)
                    .then(chordId => {
                        if (chordId) {
                            window.location.href = `/${chordId}?offline-index=${offlineIndex+1}`;
                        }
                    })

            }, 3000);
        }
    }

    chordSheetLoadFailed(error: any) {
        // Couldn't load the chord sheet from the network? See if it's in our local cache.
        const chordId = this.location?.params["id"] as string;
        if (!chordId) {
            this.error = "Couldn't load chord from local cache because we couldn't find an chord ID in the URL.";
            return;
        }

        // If the chord sheet is in the cache, cool, let's just use that.
        this.chordCache.get(chordId)
            .then(chord => chord ? this.chordSheetLoaded(chord) : this.error = `Unable to load chord from API and from cache: ${error}`)
            .catch(cacheError => this.error = `Unable to load chord from API due to error ${error}. Failed to load from cache due to cache error: ${cacheError}`);
    }

    render(): TemplateResult {
        let content: TemplateResult;
        if (this.error) {
            content = this.renderError();
        } else if (!this.chord) {
            content = this.renderLoading();
        } else {
            content = this.renderChordDetails(this.chord);
        }

        return html`
            <section class="container mx-auto">
                <div class="text-center">
                    ${content}
                </div>
            </section>
            ${this.renderPrintableScreenshots()}
        `;
    }

    renderPrintableScreenshots(): TemplateResult {
        // If the chord chart is not in the new plain text format and we have screenshots, render them but hidden.
        // This accomplishes 2 purposes:
        //  1. Fetches the screenshots, making them available offline and enabling offline rendering of this page.
        //  2. Makes printing easier. Printing iframes is fraught with issues. Printing images isn't.
        if (!this.chord || !this.hasScreenshots || !!this.chord.chords) {
            return html``;
        }

        return html`
            <div class="printable-screenshots">
                ${this.renderScreenshots(this.chord)}
            </div>
        `;
    }

    renderLoading(): TemplateResult {
        return html`
            <div class="gx-2 row loading-name-artist">
                <div class="placeholder-glow col-6 col-sm-4 offset-sm-2">
                    <span class="placeholder w-100 d-inline-block"></span>
                </div>
                <div class="placeholder-glow col-6 col-sm-4">
                    <span class="placeholder w-100 d-inline-block"></span>
                </div>
            </div>

            <div class="iframe-loading-placeholder mx-auto">
                <div class="w-100 h-100"></div>
            </div>
        `;
    }

    renderError(): TemplateResult {
        return html`
            <div class="alert alert-warning d-inline-block mx-auto" role="alert">
                Woops, we hit a problem loading this chord chart.
                <a href="${window.location.href}" class="alert-link">
                    Try again
                </a>
                <hr>
                <p class="mb-0">
                    Additional error details: ${this.error}
                </p>
            </div>
        `;
    }

    renderChordDetails(chord: ChordSheet): TemplateResult {
        // For printing, we have special handling for the header (title and author).
        // - If the chord chart is in the new format, include the header in the print.
        // - If the chord chart isn't in the new format, don't include the header in the print.
        const headerClass = !!chord.chords ? "" : "d-print-none";
        return html`
            <!-- Song details -->
            <div class="row ${headerClass}">
                <div class="col-12 col-lg-12">
                    <div class="d-flex justify-content-between align-items-center mb-sm-4">
                        <h1 class="song-name">${chord.song}</h1>
                        <span class="hebrew-song-name" lang="he">${chord.hebrewSongName}</span>
                        <h5 class="artist-author-name">
                            <a href="/artist/${encodeURIComponent(chord.artist || chord.authors[0])}">
                                ${chord.artist || chord.authors.join(", ")}
                            </a>
                        </h5>
                    </div>
                </div>
            </div>

            <!-- Song toolbar -->
            <div class="row d-print-none">
                <div class="col-12 col-lg-8">
                    <div class="btn-toolbar">
                        <div class="btn-group" role="group" aria-label="Chord chart toolbar">
                            <a href="${this.downloadUrl(chord)}" target="_blank" download="" class="btn btn-light" title="Download" aria-label="Download">
                                <img src="/assets/bs-icons/save.svg" alt="Download">
                            </a>
                            <button type="button" class="btn btn-light" title="Print" @click="${this.print}" aria-label="Print">
                                <img src="/assets/bs-icons/printer.svg" alt="Print">
                            </button>
                            ${this.renderTransposeButtons(chord)}
                            ${this.renderPlayButton(chord)}
                            ${this.renderFullScreenButton()}
                            ${this.renderOpenInGDriveButton(chord)}
                            <a href="/${chord.id}/edit" class="btn btn-light" title="Edit chord chart" aria-label="Edit chord chart">
                                <img src="/assets/bs-icons/pencil-square.svg" alt="Edit" style="transform: translateY(2px)" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Chords and sidebar -->
            <div class="row">
                <div class="col-12 col-lg-8">
                    ${this.renderChordPreviewer(chord)}
                </div>

                <!-- Sidebar -->
                <div class="sidebar col-lg-4">
                <div class="card">
                    <div class="card-header">
                        Song
                    </div>
                    <div class="card-body">
                        <h5 class="card-title">Special title treatment</h5>
                        <p class="card-text">With supporting text below as a natural lead-in to additional content.</p>
                        <a href="#" class="btn btn-primary">Go somewhere</a>
                    </div>
                    </div>
                </div>
            </div>
            <p style="display: none">
                ${chord.plainTextContents}
            </p>
        `;
    }

    renderPlayButton(chord: ChordSheet): TemplateResult {
        const chavahLink =
            chord.links.find(url => url.startsWith("https://messianicradio.com") && url.includes("song=songs/")) ||
                (chord.chavahSongId ? `https://messianicraido.com?song=${chord.chavahSongId}` : null);
        const youtubeLink = chord.links.find(l => l.startsWith("https://youtube.com/watch?v="));
        const playLink = chavahLink || youtubeLink;
        if (!playLink) {
            return html``;
        }

        const iconName = chavahLink ? "play-circle.svg" : "youtube.svg";
        return html`
            <a href="${playLink}" target="_blank" class="btn btn-light" title="Play this song" aria-label="Play this song">
                <img src="/assets/bs-icons/${iconName}" alt="Play icon">
            </a>
        `;
    }

    renderFullScreenButton(): TemplateResult {
        if (!this.canGoFullScreen) {
            return html``;
        }

        return html`
            <button type="button" class="btn btn-light" title="View fullscreen" @click="${this.goFullscreen}" aria-label="View fullscreen">
                <img src="/assets/bs-icons/arrows-fullscreen.svg" alt="Fullscreen">
            </button>
        `;
    }

    renderOpenInGDriveButton(chord: ChordSheet): TemplateResult {
        // Do we have this thing on Google Drive?
        const address = chord.publishUri || chord.address;
        if (!address) {
            return html``;
        }

        return html`
            <a href="${address}" target="_blank" class="btn btn-light" title="Open on Google Drive" aria-label="Open on Google Drive">
                <img src="/assets/bs-icons/box-arrow-up-right.svg" alt="Open">
            </a>
        `;
    }

    renderTransposeButtons(chord: ChordSheet): TemplateResult {
        // We can only do this for plain text chord sheets.
        if (!chord.chords) {
            return html``;
        }

        const positiveTransposeClass = this.transpose > 0 ? "d-inline" : "d-none";
        const negativeTransposeClass = this.transpose < 0 ? "d-inline" : "d-none";
        return html`
            <button type="button" class="btn btn-light transpose-btn" title="Transpose down a half-step" aria-label="Transpose down a half-step" @click="${() => this.bumpTranspose(-1)}">
                <img src="/assets/bs-icons/dash.svg" alt="-" />
                <span class="text-muted ${negativeTransposeClass}">${this.transpose}</span>
            </button>
            <button type="button" class="btn btn-light transpose-btn" title="Transpose up a half-step" aria-label="Transpose down a half-step" @click="${() => this.bumpTranspose(1)}">
                <img src="/assets/bs-icons/plus.svg" alt="+" />
                <span class="text-muted ${positiveTransposeClass}">${this.transpose}</span>
            </button>
        `;
    }

    renderChordPreviewer(chord: ChordSheet): TemplateResult {
        // Best case scenario: Do we have plain text chords? Cool, use those.
        if (chord.chords) {
            return this.renderPlainTextPreviewer(chord);
        }

        // If we're not online, see if we can render the offline previewer (i.e. the screenshots of the doc)
        // This is needed because we can't load iframes of other domains (Google Docs) while offline, even with service worker caching.
        let previewer: TemplateResult;
        if (!navigator.onLine) {
            previewer = this.renderOfflinePreviewer(chord);
        } else {
            switch (chord.extension) {
                case "gif":
                case "jpg":
                case "jpeg":
                case "tiff":
                case "png":
                    previewer = this.hasScreenshots ? this.renderScreenshots(chord) : this.renderImagePreviewer(this.downloadUrl(chord));
                    break;
                case "pdf":
                    // Do we have a screenshot of the doc? Use that. PDF preview is quite buggy and heavyweight.
                    previewer = this.hasScreenshots ? this.renderScreenshots(chord) : this.renderGDocPreviewer(chord);
                    break;
                default:
                    previewer = this.renderGDocPreviewer(chord);
            }
        }

        // If we have screenshots, we'll use those for printing and hide the previewer during print.
        if (this.hasScreenshots) {
            return html`
                <div class="d-print-none">
                    ${previewer}
                </div>
            `;
        }

        return previewer;
    }

    renderPlainTextPreviewer(chord: ChordSheet): TemplateResult {
        const lines = this.getChordChartLines(chord);
        // <p class="plain-text-preview">${chord.chords}</p>
        return html`
            <p class="plain-text-preview">${repeat(lines, l => lines.indexOf(l), l => this.renderPlainTextLine(l))}</p>
        `;
    }

    renderPlainTextLine(line: ChordChartLine): TemplateResult {
        if (line.type === "lyrics") {
            return this.renderPlainTextLyricLine(line);
        }

        return this.renderPlainTextChordLine(line);
    }

    renderPlainTextLyricLine(chordLine: ChordChartLine): TemplateResult {
        return html`<span>${chordLine.spans[0].value}</span>\n`;
    }

    renderPlainTextChordLine(chordLine: ChordChartLine): TemplateResult {
        return html`${repeat(chordLine.spans, i => chordLine.spans.indexOf(i), s => this.renderPlainTextSpan(s))}\n`;
    }

    renderPlainTextLyricSpan(span: ChordChartSpan) {
        return html`<span>${span.value}</span>`;
    }

    renderPlainTextSpan(span: ChordChartSpan): TemplateResult {
        if (span.type === "other") {
            return this.renderPlainTextLyricSpan(span);
        }

        const chord = Chord.tryParse(span.value);
        if (!chord) {
            return this.renderPlainTextLyricSpan(span);
        }

        const chordStartIndex = span.value.indexOf(chord.fullName);
        const chordEndIndex = chordStartIndex + chord.fullName.length;
        const whitespaceStart = chordStartIndex > 0 ? span.value.slice(0, chordStartIndex) : "";
        const whitespaceEnd = span.value.slice(chordEndIndex);
        const transposedChord = chord.transpose(this.transpose);
        return html`<span>${whitespaceStart}</span><span class="chord">${transposedChord.fullName}</span><span>${whitespaceEnd}</span>`;
    }

    renderGDocPreviewer(chord: ChordSheet): TemplateResult {
        return html`
            <iframe class="${this.iframeClass}" src="${this.iframeUrl}" title="${chord.artist}" allowfullscreen zooming="true"
                frameborder="0"></iframe>
        `;
    }

    renderImagePreviewer(imgSrc: string): TemplateResult {
        return html`
            <div class="img-preview">
                <img class="img-fluid" src="${imgSrc}" />
            </div>
        `;
    }

    renderScreenshots(chord: ChordSheet): TemplateResult {
        return html`
            <div class="d-flex flex-column">
                ${repeat(chord.screenshots, k => k, i => this.renderImagePreviewer(i))}
            </div>
        `;
    }

    renderOfflinePreviewer(chord: ChordSheet): TemplateResult {
        if (chord.screenshots.length == 0) {
            return html`
                <div class="alert alert-warning d-inline-block mx-auto" role="alert">
                    ⚠ This chord sheet is not available offline.
                    <p class="mb-0">
                        ℹ️ To make this chord chart available offline, first view it while you're online.
                    </p>
                </div>
            `;
        }

        return this.renderScreenshots(chord);
    }

    loadChordSheet(): Promise<ChordSheet> {
        // Grab the chord sheet id
        const chordId = `ChordSheets/${this.location?.params["id"]}`;
        return this.chordService.getById(chordId);
    }

    get iframeUrl(): string {
        if (!this.chord) {
            return "";
        }

        if (this.chord.publishUri) {
            return `${this.chord.publishUri}?embedded=true`;
        }

        // TODO: Consider migrating away from this buggy thing and move towards Adobe's free PDF previewer.
        // See https://developer.adobe.com/document-services/apis/pdf-embed/
        if (this.chord.extension === "pdf") {
            return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(this.downloadUrl(this.chord))}`;
        }

        return `https://docs.google.com/document/d/${this.chord.googleDocId}/preview?resourcekey=${this.chord.googleDocResourceKey}`;
    }

    get pageClass(): string {
        if (!this.chord) {
            return "";
        }

        if (this.chord.pagesCount === 0 || this.chord.pagesCount === 1) {
            return "one-page";
        }

        if (this.chord.pagesCount === 2) {
            return "two-page";
        }

        return "three-page";
    }

    get iframeClass(): string {
        if (this.isWebPublished) {
            return this.pageClass + " web-published-doc";
        }

        return this.pageClass;
    }

    cacheChordForOfflineSearch(chord: ChordSheet) {
        this.chordCache.add(chord)
            .catch(cacheError => console.warn("Unable to add chord sheet to offline chord cache due to an error", cacheError));
    }

    print() {
        window.print();
    }

    downloadUrl(chord: ChordSheet): string {
        return this.chordService.downloadUrlFor(chord);
    }

    goFullscreen() {
        const plainTextPreview = this.shadowRoot?.querySelector(".plain-text-preview");
        const imgPreview = this.shadowRoot?.querySelector("img-preview");
        const iframe = this.shadowRoot?.querySelector("iframe");
        (plainTextPreview || imgPreview || iframe)?.requestFullscreen();
    }

    getChordChartLines(chord: ChordSheet): ChordChartLine[] {
        if (!this.chordChartLines) {
            this.chordChartLines = createChordChartLines(chord.chords);
        }

         return this.chordChartLines;
    }

    bumpTranspose(increment: 1 | -1) {
        this.transpose += increment;

        // 12 half-steps in the musical scale (A, Bb, B, C, C#, D, D#, E, E#, F, F#, G)
        // If we go outside the scale, wrap to the other side.
        if (this.transpose === 12 || this.transpose === -12) {
            this.transpose = 0;
        }
    }
}