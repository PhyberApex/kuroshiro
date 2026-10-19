# A polled XML feed and a CSV table are read as TRMNL reads them

TRMNL polls "JSON, RSS, XML, plaintext, or CSV" (help.trmnl.com, "Private Plugins"), and trmnlp shows how: an XML content type goes through Rails' `Hash.from_xml`, `text/csv` through `CSV.parse` under `data`, everything else is tried as JSON and otherwise passed through as text under `data`. A Recipe on the second page of trmnl.com/recipes polls an RSS feed and starts its markup with `{% assign item = rss.channel.item | first %}`; Kuroshiro handed the feed to the Template as one string, so it drew no strip.

**A fetched body whose content type is XML is read into an object in `Hash.from_xml`'s shape**: `text/xml`, `application/xml` and any `application/*+xml`, which covers RSS and Atom. The root element is the top key; an element with text is that text, its attributes dropped; an element with children or attributes is an object of them, attributes beside children; a child repeated under one parent is a list and a single one an object; an empty element is nothing; CDATA reads as its text; a byte order mark is stripped first. Namespaced names keep their prefix (`media:content`), as Rails keeps them. XML that does not parse stays text, as before.

**A `text/csv` body is read as rows of cells under `data`**, with RFC 4180 quoting, so `{{ data[1][0] }}` reads the second row's first cell.

**JSON stays JSON whatever the content type says**, since endpoints serve it as `text/plain` and `text/html` often enough; anything else that is not JSON stays text. A transform gets the parsed value, as trmnlp's transform runs on the parsed data.

Considered and rejected:

- **Rails' `type` attribute casting** (`type="integer"`, `type="array"`). It is a Rails serialisation convention a feed never uses; a Template reading a feed expects strings, as it does from Liquid.
- **Keeping attributes beside the text under `__content__`.** Rails drops attributes once an element has text, so `rss.channel.item.first.title` is the string a Recipe expects rather than an object.
- **A CSV with headers read as a list of objects.** TRMNL reads rows; a Recipe written for it indexes rows.

## Consequences

- `fast-xml-parser` joins the API's dependencies; the shaping to `Hash.from_xml`'s form is Kuroshiro's own and lives beside the fetcher.
- A transform that received an Atom feed as text under `input.data` now receives an object; the probed Recipes that parse a feed fetch it themselves inside the transform, where the `Response` is still theirs to read as text.
- A lone XML Data Source reads at the root through ADR-0049, so `{{ rss.channel.title }}` works unprefixed, as on TRMNL.
