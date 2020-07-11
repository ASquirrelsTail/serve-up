<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { post, patch, del, toData } from '../fetch.js';
  import Switch from '../Switch.svelte'
  export let section = {};

  const dispatch = createEventDispatcher();

  let name, description, visible;
  let error = false;
  let errors = {};
  let sending = false;

  onMount(() => {
    if (!section.id){
      name = '';
      description = '';
      visible = true;
    } else {
      ({name, description, visible} = section);
    }
  })

  function add() {
    sending = true;
    post('/menu/sections/', {name, description, visible}).then(response => {
      if (response.status === 200 || response.status === 400) return response.json();
      if (response.status === 403) {
        error = 'You are not allowed to add new sections';
        sending = false;
      }
    }).then(data => {
      if (data.error) {
        error = data.error;
        errors = data.errors;
      }
      else {
        dispatch('update', {'section': data});
        section = data;
        ({name, description, visible} = data);
      }
      sending = false;
    });
  }

  function update() {
    sending = true;
    patch('/menu/sections/' + section.id + '/', {name, description, visible}).then(response => {
      if (response.status === 200 || response.status === 400) return response.json();
      if (response.status === 403) error = 'You are not allowed to update sections.';
      if (response.status === 404) error = 'Section not found.';
      sending = false;
    }).then(data => {
      if (data) {
        if (data.error) {
          error = data.error;
          errors = data.errors;
        }
        else {
          dispatch('update', {'section': data});
          section = data;
          ({name, description, visible} = data);
        }
      }
      sending = false;
    });
  }

  function delSection() {
    sending = true;
    del('/menu/sections/' + section.id + '/').then(response => {
      if (response.status === 204) dispatch('delete', {section: {id: section.id}});
      if (response.status === 403) error = 'You are not allowed to delete sections.'
      if (response.status === 404) error = 'Section not found.';
      sending = false;
    });
  }
</script>

<div>
  {#if !section.id}
  <h3>New Section</h3>
  {:else}
  <h3>{section.name}</h3>
  {/if}
  <p class="error" class:show={error}>{error}</p>
  <form on:submit|preventDefault="{() => {}}">
    <div class="name">
      <label for="name">Item name:</label>
      <input id="name" type="text" bind:value={name} on:input="{() => error=false}" required>
    </div>
  <div class="description">
    <label for="description">Description:</label>
    <textarea id="description" bind:value={description}></textarea>
  </div>
  </form>
  <div class="visible">
    Visible: <Switch bind:set={visible} />
  </div>
  <div class="buttons">
    {#if !section.id}
    <button class="primary md" on:click={add} disabled={sending}>Add Section</button>
    {:else}
    <button class="primary md" on:click={update} disabled={sending}>Update Section</button>
    <button class="secondary md" on:click={delSection}>Delete Section</button>
    {/if}
  </div>
</div>

<style>

  h3 {
    text-align: center;
  }

  .name {
    display: flex;
    width: 80%;
    margin: auto;
  }
  .name label {
    display: block;
    flex-grow: 1;
  }

  .name input {
    width: 60%;
  }

  .description {
    width: 80%;
    margin: auto;
  }

  .description textarea {
    width: 100%;
    height: 5em;
    resize: none;
  }

  .visible {
    width: 80%;
    margin: auto;
    margin-top: 0.3em;
    margin-bottom: 0.3em;
  }

  .error {
    color: red;
    font-size: 0.8em;
    margin: 0;
    display: none;
  }

  .error.show {
    display: block;
  }

  .buttons {
    text-align: center;
  }
</style>