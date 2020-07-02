<script>
  import { createEventDispatcher } from 'svelte';
  export let orders;

  const dispatch = createEventDispatcher();
</script>

{#each orders as order (order.id)}
  <div class="order">
    <div class="details">
      <span>{order.group}</span> - <span>{order.no_items} items</span>
      {#if order.paid} - <span>PAID</span>{/if}
    </div>
    <div class="total">
      £{order.total}
    </div>
    <div>
      <button class="primary md" on:click="{() => dispatch('editorder', order)}">View</button>
    </div>
  </div>
{/each}

<style>
  span {
    display: inline-block;
  }

  .order {
    display: flex;
    align-items: center;
    padding: 0.2em;
  }

  .details {
    flex-grow: 1;
  }

  .total {
    width: 20%;
    flex-shrink: 0;
    text-align: right;
    padding-right: 0.2em;
  }

  button {
    flex-shrink: 1;
  }
</style>