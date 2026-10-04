/** The one `full` Template a built Plugin starts with. It reads the name from `trmnl`, so renaming the Plugin renames what the Device shows. */
export const STARTER_TEMPLATE = `<div class="layout layout--col layout--center">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`
