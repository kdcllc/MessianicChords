﻿using EllipticCurve.Utils;
using Raven.Client.Documents.Session;
using System.Text.RegularExpressions;

namespace MessianicChords.Services
{
    public class FingerprintedResourceService
    {
        private readonly IAsyncDocumentSession dbSession;
        private readonly IWebHostEnvironment webHost;
        private readonly ILogger<FingerprintedResourceService> logger;
        private FingerprintedResources? resources;

        public FingerprintedResourceService(
            IAsyncDocumentSession dbSession, 
            IWebHostEnvironment webHost,
            ILogger<FingerprintedResourceService> logger)
        {
            this.dbSession = dbSession;
            this.webHost = webHost;
            this.logger = logger;
        }

        public async Task<FingerprintedResources?> GetResourcesAsync()
        {
            if (this.resources != null)
            {
                return this.resources;
            }

            try
            {
                this.resources = await LoadFingerprintedResources();
                return this.resources;
            }
            catch (Exception error)
            {
                logger.LogError(error, "Unable to fetch fingerprinted resources due to an error.");
                return null;
            }
        }

        private async Task<FingerprintedResources> LoadFingerprintedResources()
        {
            var indexHtmlPath = Path.Combine(this.webHost.WebRootPath, "index.html");
            var indexHtml = await System.IO.File.ReadAllTextAsync(indexHtmlPath);

            var jsRegex = new Regex("(/code/index.\\w+.js)");
            var jsMatch = jsRegex.Match(indexHtml);
            var jsUrl = jsMatch != null && jsMatch.Captures.Count > 0 ? jsMatch.Captures[0].Value : null;

            var cssRegex = new Regex("(/code/index.\\w+.css)");
            var cssMatch = cssRegex.Match(indexHtml);
            var cssUrl = cssMatch != null && cssMatch.Captures.Count > 0 ? cssMatch.Captures[0].Value : null;

            if (jsUrl == null)
            {
                logger.LogError("Failed to load fingerprinted index JS from {dir}", indexHtmlPath);
                throw new InvalidOperationException("Couldn't find fingerprinted JS in index.html");
            }

            return new FingerprintedResources(new Uri(jsUrl, UriKind.Relative), cssUrl != null ? new Uri(cssUrl, UriKind.Relative) : null);
        }
    }

    public record FingerprintedResources(Uri IndexJs, Uri? IndexCss);
}
