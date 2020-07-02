<script>
  import { createEventDispatcher } from 'svelte';
  export let id = '';
  export let count = 0;

  const dispatch = createEventDispatcher();

  function add() {
    dispatch('count', count + 1)
  }

  function remove() {
    dispatch('count', Math.max(count - 1, 0));
  }

  function update() {
    dispatch('count', Math.max(count, 0));
  }
</script>

<div class="count">
  <button class="minus" on:click={remove} disabled="{count < 1}">-</button>
  <input type="number" min=0 bind:value={count} on:input={update} id={id}>
  <button class="plus" on:click={add}>+</button>
</div>

<style>
  .count {
    flex-shrink: 0;
  }
</style>