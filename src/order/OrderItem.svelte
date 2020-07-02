<script>
  import Count from '../Count.svelte'
  import { orderList } from '../store.js';
  export let id;
  export let name = 'Order Item';
  export let price = '0.00';
  export let vat = true;
  export let count = 0;

  let total = count * parseFloat(price);

  function update(e) {
    count = e.detail;
    orderList.addOrUpdate({id, name, price, vat, count});
  }

</script>

<div class="order-item">
  <div class="details">
    <label for="order-count-{id}">{name}</label>
  </div>
  <Count {count} id="order-count-{id}" on:count={update}/>
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
    flex-shrink: 0;
    text-align: right;
  }
</style>
