<script>
  import { orderList } from '../store.js';
  export let id;
  export let name = 'Order Item';
  export let price = '0.00';
  export let vat = true;
  export let count = 0;

  let total = count * parseFloat(price);

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

<div class="order-item">
  <div class="details">
    {name}
  </div>
  <div class="count">
    <button class="minus" on:click={remove}>-</button>
    <input type="number" min=0 bind:value={count} on:change={update}>
    <button class="plus" on:click={add}>+</button>
  </div>
  <div class="total">
    £{total.toFixed(2)}
  </div>
</div>

<style>
  .order-item {
    display: flex;
    align-items: center;
    padding: 0.2em;
  }

  .details {
    flex-grow: 1;
    text-align: left;
  }

  .total {
    width: 20%;
    text-align: right;
  }
</style>
