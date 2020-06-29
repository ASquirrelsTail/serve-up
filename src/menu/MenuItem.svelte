<script>
  import { orderList } from '../store.js';
  export let name = 'Menu Item';
  export let description = false;
  export let price = '0.00';
  export let vat = true;
  export let id;
  export let order = 1;
  export let visible = true;

  let count = 0;

  $: {
    const orderItem = $orderList.find(item => item.id === id);
    if (orderItem) count = orderItem.count;
    else count = 0;
  }

  function update() {
    orderList.addOrUpdate({id, name, price, vat, count});
  }

  function add() {
    count++;
    update();
  }

  function remove() {
    count =  Math.max(count - 1, 0);
    update();
  }
</script>

<div class="menu-item">
  <div class="details">
    <h3 class="name">{name}</h3>
    {#if description}
    <p class="description">{description}</p>
    {/if}
  </div>
  <div class="order">
    <div class="price">£{price} ea.</div>
    <div class="count">
      <button class="minus" on:click={remove}>-</button>
      <input type="number" min=0 bind:value={count} on:change={update}>
      <button class="plus" on:click={add}>+</button>
    </div>
  </div>
</div>

<style>
  .menu-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.3em 0.2em;
  }

  h3 {
    margin-top: 0;
  }

  .price {
    text-align: center;
    font-weight: bold;
  }

  .count input {
    width: 2em;
    text-align: center;
  }

</style>

