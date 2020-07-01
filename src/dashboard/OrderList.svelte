<script>
  import { createEventDispatcher } from 'svelte';
  export let orders;

  const dispatch = createEventDispatcher();
</script>

{#each orders as order (order.id)}
  <div class="order">
    <div class="details">
      {order.group} - {order.no_items} items {order.paid ? '- PAID' : ''}
    </div>
    <div class="total">
      £{order.total}
    </div>
    <div>
      <button on:click="{() => dispatch('editorder', order)}">Review Order</button>
    </div>
  </div>
{/each}

<style>
  .order {
    display: flex;
  }

  .details {
    flex-grow: 1;
  }

  .total {
    width: 20%;
    text-align: right;
  }
</style>