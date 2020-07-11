<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Switch from '../Switch.svelte'
  export let section = {};

  let name, description, visible;
  let error = false;
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

  }

  function update() {

  }

  function delSection() {

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