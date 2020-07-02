<script>
  import Count from '../Count.svelte'
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

  function update(e) {
    count = e.detail;
    orderList.addOrUpdate({id, name, price, vat, count});
  }

</script>

<div class="menu-item">
  <div class="details">
    <h3 class="name"><label for="menu-count-{id}">{name}</label></h3>
    {#if description}
    <p class="description">{description}</p>
    {/if}
  </div>
  <div class="order">
    <div class="price">£{price} ea.</div>
    <Count {count} id="menu-count-{id}" on:count={update}/>
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

  .order {
    flex-shrink: 0;
  }

  .price {
    text-align: center;
    font-weight: bold;
  }
</style>

