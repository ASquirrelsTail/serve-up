<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Switch from '../Switch.svelte'
  import { post, patch, del, toData } from '../fetch.js';
  export let item = {};
  export let section = false;

  const dispatch = createEventDispatcher();

  let name, description, price, vat, visible;
  let error = false;
  let errors = {};
  let sending = false;
  onMount(() => {
    if (!item.id){
      name = '';
      description = '';
      price = '0.00';
      vat = true;
      visible = true;
    } else {
      ({name, description, price, vat, visible} = item);
    }
  })

  function add() {
    sending = true;
    post('/menu/items/', {name, description, price, vat, visible, section: section.id}).then(response => {
      if (response.status === 200 || response.status === 400) return response.json();
      if (response.status === 403) {
        error = 'You are not allowed to add new items';
        sending = false;
      }
    }).then(data => {
      if (data.error) {
        error = data.error;
        errors = data.errors;
      }
      else {
        data.sectionId = section.id;
        dispatch('update', {'item': data});
        item = data;
        ({name, description, price, vat, visible} = data);
      }
      sending = false;
    });
  }

  function update() {
    patch('/menu/items/' + item.id + '/', {name, description, price, vat, visible}).then(response => {
      if (response.status === 200 || response.status === 400) return response.json();
      if (response.status === 403) error = 'You are not allowed to update items.';
      if (response.status === 404) error = 'Item not found.';
      sending = false;
    }).then(data => {
      if (data) {
        if (data.error) {
          error = data.error;
          errors = data.errors;
        }
        else {
          data.sectionId = section.id;
          dispatch('update', {'item': data});
          item = data;
          ({name, description, price, vat, visible} = data);
        }
      }
      sending = false;
    });
  }

  function delSection() {
    sending = true;
    del('/menu/items/' + item.id + '/').then(response => {
      if (response.status === 204) dispatch('delete', {item: {id: item.id, sectionId: section.id}});
      if (response.status === 403) error = 'You are not allowed to delete items.'
      if (response.status === 404) error = 'Item not found.';
      sending = false;
    });
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
      <input id="name" type="text" bind:value={name} on:input="{() => errors.name=false}" class:invalid={errors.name} required>
    </div>
    <p class="error" class:show={errors.name}>{errors.name}</p>
  <div class="description">
    <label for="description">Description:</label>
    <textarea id="description" bind:value={description}></textarea>
  </div>
  <div class="price">
    <label for="price">Price:</label>
    £<input type="number" id="price" bind:value={price} class:invalid={errors.price}>
    Vat: <Switch bind:set={vat} />
    <p class="error" class:show={errors.price}>{errors.price}</p>
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

  .description, .error {
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
    display: none;
  }

  .error.show {
    display: block;
  }

  .buttons {
    text-align: center;
  }
</style>