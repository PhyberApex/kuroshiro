<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import Icon from './Icon.vue'
</script>

<template>
  <SpecimenRow title="Primary">
    <Specimen caption="default">
      <Button variant="primary">
        Add Screen
      </Button>
    </Specimen>
    <Specimen caption="hover">
      <Button variant="primary" data-force="hover">
        Add Screen
      </Button>
    </Specimen>
    <Specimen caption="focus">
      <Button variant="primary" data-force="focus">
        Add Screen
      </Button>
    </Specimen>
    <Specimen caption="active">
      <Button variant="primary" data-force="active">
        Add Screen
      </Button>
    </Specimen>
    <Specimen caption="disabled">
      <Button variant="primary" disabled>
        Add Screen
      </Button>
    </Specimen>
    <Specimen caption="loading">
      <Button variant="primary" loading>
        Add Screen
      </Button>
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="Plain">
    <Specimen caption="default">
      <Button>Update now</Button>
    </Specimen>
    <Specimen caption="hover">
      <Button data-force="hover">
        Update now
      </Button>
    </Specimen>
    <Specimen caption="focus">
      <Button data-force="focus">
        Update now
      </Button>
    </Specimen>
    <Specimen caption="active">
      <Button data-force="active">
        Update now
      </Button>
    </Specimen>
    <Specimen caption="disabled">
      <Button disabled>
        Update now
      </Button>
    </Specimen>
    <Specimen caption="loading">
      <Button loading>
        Update now
      </Button>
    </Specimen>
    <Specimen caption="destructive: plain, never red">
      <Button>Delete Screen</Button>
    </Specimen>
    <Specimen caption="with an icon">
      <Button><Icon name="upload" />Choose a file</Button>
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="Quiet">
    <Specimen caption="default">
      <Button variant="quiet">
        Remove Schedule
      </Button>
    </Specimen>
    <Specimen caption="hover">
      <Button variant="quiet" data-force="hover">
        Remove Schedule
      </Button>
    </Specimen>
    <Specimen caption="focus">
      <Button variant="quiet" data-force="focus">
        Remove Schedule
      </Button>
    </Specimen>
    <Specimen caption="active">
      <Button variant="quiet" data-force="active">
        Remove Schedule
      </Button>
    </Specimen>
    <Specimen caption="disabled">
      <Button variant="quiet" disabled>
        Remove Schedule
      </Button>
    </Specimen>
    <Specimen caption="loading">
      <Button variant="quiet" loading>
        Remove Schedule
      </Button>
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="As a link">
    <Specimen caption="primary">
      <Button variant="primary" as-child>
        <a href="#button">Add Screen</a>
      </Button>
    </Specimen>
    <Specimen caption="plain">
      <Button as-child>
        <a href="#button">Open the template</a>
      </Button>
    </Specimen>
    <Specimen caption="quiet">
      <Button variant="quiet" as-child>
        <a href="#button">See the error</a>
      </Button>
    </Specimen>
  </SpecimenRow>
</template>
