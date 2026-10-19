# A webhook Recipe imports as a Webhook Plugin

Two of the twenty-five Recipes on the second page of trmnl.com/recipes have `strategy: webhook`: TRMNL renders them from whatever an external system POSTs. Kuroshiro has had Webhook-kind Plugins since ADR-0004 and its ZIP importer maps a Terminus archive's `strategy: webhook` to that Kind; only the Recipe path refused the strategy, with the message that TRMNL pushes the data. #1261 lifted the same refusal for `strategy: none`.

**A `strategy: webhook` Recipe imports as a Webhook Plugin**: its Templates with `shared.liquid` on top (ADR-0050), its Plugin Fields, screen modifiers and framework version as for a polling Recipe, no Data Sources, and the standard Merge Strategy, since a Recipe archive names none. The admin gets a Webhook URL on the Plugin's page as for a built Webhook Plugin and points the pushing system at it.

**A webhook Recipe that ships a transform is refused**, with `recipe-webhook-transform`. TRMNL runs the serverless code once on each payload it is sent (trmnlp's `WebhookReceiver` does the same); a Webhook Plugin here stores the payload as it arrives and runs nothing. Importing the Recipe with the transform dropped would render a Template over data in the wrong shape, silently; refusing says what is missing. None of the probed Recipes ships one with JavaScript.

**A `strategy: plugin_merge` Recipe stays refused**, now saying why: it reads other TRMNL plugin instances' data through `plugin_instance_select` fields, which only trmnl.com holds.

Considered and rejected:

- **Importing a webhook Recipe's transform as something a Webhook Plugin runs on arrival.** That is a new capability of Webhook Plugins, with its own decision about state and failures; the refusal keeps the door open.
- **Refusing webhook Recipes as before and telling the admin to build one.** The Templates and Fields are the Recipe; retyping them is what the importer exists to avoid.

## Consequences

- The import form's line reads "Imports as a Poll or Webhook Plugin you can edit"; the refusal for a webhook strategy goes and `recipe-webhook-transform` joins the codes the form words.
- The Recipe Update Check compares Templates and Fields as for any Recipe; a Webhook Plugin has no Data Sources to compare.
