<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Switch from '../Switch.svelte'
  export let item = {};

  let name, description, price, vat, visible;
  let error = false;
  let sending = false;
  onMount(() => {
    if (!item.id){
      name = '';
      description = '';
      price = 0;
      vat = true;
      visible = true;
    } else {
      ({name, description, price, vat, visible} = item);
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
  {#if !item.id}
  <h3>New Item</h3>
  {:else}
  <h3>{item.name}</h3>
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
  <div class="price">
    <label for="price">Price:</label>
    £<input type="number" id="price" bind:value={price}>
    Vat: <Switch bind:set={vat} />
  </div>
  </form>
  <div class="visible">
    Visible: <Switch bind:set={visible} />
  </div>
  <div class="buttons">
    {#if !item.id}
    <button class="primary md" on:click={add} disabled={sending}>Add Item</button>
    {:else}
    <button class="primary md" on:click={update} disabled={sending}>Update Item</button>
    <button class="secondary md" on:click={delSection}>Delete Item</button>
    {/if}
  </div>
</div>

<style>

  h3 {
    text-align: center;
  }

  label {
    padding-right: 0.5em;
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

  .price {
    width: 80%;
    margin: auto;
  }

  #price {
    width: 4em;
    text-align: right;
    margin-right: 1em;
  }

  .visible {
    width: 80%;
    margin: auto;
    margin-top: 0.3em;
    margin-bottom: 0.3em;
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
</style>