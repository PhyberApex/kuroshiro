import type { LogEntry } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

function createLogStore(deviceId: string) {
  return () => {
    const error = ref('')
    const logEntries = ref([] as LogEntry[])
    const loading = ref(true)

    const clearLogs = async () => {
      loading.value = true
      const res = await fetch(`/api/log/device/${deviceId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        error.value = ''
      }
      loading.value = false
    }

    fetch(`/api/log/device/${deviceId}`).then(async (res) => {
      loading.value = false
      if (res.ok) {
        error.value = ''
        // logEntries.value = await res.json()
        logEntries.value = [{
          logId: 351,
          date: new Date(),
          entry: '{"creation_timestamp":1764017623,"device_status_stamp":{"wifi_rssi_level":-48,"wifi_status":"connected","refresh_rate":306,"time_since_last_sleep_start":307,"current_fw_version":"1.5.5","special_function":"none","battery_voltage":3.76,"wakeup_reason":"timer","free_heap_size":214724,"max_alloc_size":143348},"log_id":351,"log_message":"Error fetching API display: 7, detail: HTTP Client failed with error: read Timeout(-11)","log_codeline":586,"log_sourcefile":"src/bl.cpp","additional_info":{"filename_current":"plugin-950fdf-1763939665","filename_new":"","retry_attempt":1}}',
        }, {
          logId: 352,
          date: new Date(),
          entry: '{"creation_timestamp":1764073443,"device_status_stamp":{"wifi_rssi_level":-45,"wifi_status":"connected","refresh_rate":295,"time_since_last_sleep_start":296,"current_fw_version":"1.5.5","special_function":"none","battery_voltage":3.73,"wakeup_reason":"timer","free_heap_size":214724,"max_alloc_size":139252},"log_id":352,"log_message":"Error fetching API display: 7, detail: HTTP Client failed with error: read Timeout(-11)","log_codeline":586,"log_sourcefile":"src/bl.cpp","additional_info":{"filename_current":"plugin-fef2cc-1764026058","filename_new":"","retry_attempt":1}}',
        }]
      }
    }).catch(() => {
      loading.value = false
      error.value = 'Error fetching logs.'
    })

    return { error, logEntries, loading, clearLogs }
  }
}

export function useLogStore(deviceId: string) {
  return defineStore(`log-${deviceId}`, createLogStore(deviceId))()
}
