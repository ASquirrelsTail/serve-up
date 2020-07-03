<script>
  import { createEventDispatcher } from 'svelte';
  import { post, patch, del, toData } from '../fetch.js';
  export let table;

  const dispatch = createEventDispatcher();

  let sending = false;
  let error = false;

  $: {
    if (!table.id && table.name === undefined) table = {name: ''};
  }

  function add() {
    sending = true;
    post('/tables/', {name: table.name}).then(response => {
      if (response.status === 200 || response.status === 400) return response.json();
      if (response.status === 403) {
        error = 'You are not allowed to add new tables';
        sending = false;
      }
    }).then(data => {
      if (data.error) error = data.error;
      else {
        dispatch('update', data);
        table = data;
      }
      sending = false;
    });
  }

  function update() {
    sending = true;
    patch('/tables/' + table.id + '/', {name: table.name}).then(response => {
      if (response.status === 200 || response.status === 400) return response.json();
      if (response.status === 403) error = 'You are not allowed to add new tables.';
      if (response.status === 404) error = 'Table not found.';
      sending = false;
    }).then(data => {
      if (data) {
        if (data.error) error = data.error;
        else {
          dispatch('update', data);
          table = data;
        }
      }
      sending = false;
    });
  }

  function delTable() {
    sending = true;
    del('/tables/' + table.id + '/').then(response => {
      if (response.status === 204) dispatch('delete', table.id);
      if (response.status === 403) error = 'You are not allowed to delete tables.'
      if (response.status === 404) error = 'Table not found.';
      sending = false;
    });
  }

  function submit() {
    if (!table.id) add();
    else update();
  }

</script>

<div>
  {#if !table.id}
  <h3>New Table</h3>
  {:else}
  <h3>Table {table.name}</h3>
  {/if}
  <form on:submit|preventDefault={submit}>
    <label for="name">Table name:</label>
    <div class="input-col">
      <input id="name" type="text" bind:value={table.name} on:input="{() => error=false}" required>
      <p class="error" class:show={error}>{error}</p>
    </div>
    
  </form>
  
  <div class="buttons">
    {#if !table.id}
    <button class="primary md" on:click={add} disabled={sending}>Add Table</button>
    {:else}
    <button class="primary md" on:click={update} disabled={sending}>Rename Table</button>
    <button class="secondary md" on:click={delTable}>Delete Table</button>
    <img src="{table.img}" alt="{table.url}">
    {/if}
  </div>
</div>

<style>

  h3 {
    text-align: center;
  }

  form {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.2em;
  }

  label {
    padding-right: 0.5em;
  }

  input {
    width: 100%;
  }

  .input-col {
    width: 60%;
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

  img {
    width: 90%;
    margin: auto;
    height: auto;
  }
</style>




