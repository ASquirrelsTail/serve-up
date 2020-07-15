<script>
  import { createEventDispatcher } from 'svelte';
  export let item = {};
  export let first = false;
  export let last = false;

  const dispatch = createEventDispatcher();
</script>

<div class="striped" class:hidden={!item.visible}>
  <div class="details">
    <h4 class="name">{item.name}</h4>
    {#if item.description}
    <p class="description">{item.description}</p>
    {/if}
  </div>
  <div class="price">
    £{Number.parseFloat(item.price).toFixed(2)}
  </div>
  <div>
    <button class="primary md" on:click="{() => dispatch('edititem', item)}">Edit</button>
  </div>
  <div class="up-down">
    <button class="primary" on:click="{() => dispatch('moveup')}" disabled={first}>+</button>
    <button class="primary" on:click="{() => dispatch('movedown')}" disabled={last}>-</button>
  </div>
</div>

<style>
  h4 {
    margin-top: 0;
  }
  .striped {
    display: flex;
    align-items: center;
    padding: 0.2em;
  }

  .details {
    flex-grow: 1;
    padding: 0 0.2em;
  }

  .price {
    font-weight: bold;
    margin-right: 0.4em;
  }

  .up-down button {
    display: block;
    width: 1em;
    height: 1em;
    margin: 0.2em;
    margin-left: 0.4em;
    padding: 0;
  }
</style>