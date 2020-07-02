<script>
  export let order;

  let date = order.time.split('T')[0];
  let time = order.time.split('T')[1].slice(0, 8);
</script>

<div class="center">
<h2>{order.group}</h2>
<h3>{order.no_items} item{order.no_items > 1 ? 's' : ''} - £{order.total}{order.paid ? ' - PAID' : ''}</h3>
<h4>{time} - {date}</h4>
</div>
<div class="reciept-list">
  {#each order.order_items as item, i (i)}
  <div class="item-row">
    <div class="item">
      {item.item_name}
    </div>
    <div class="count">
      {item.count}
    </div>
    <div class="total">
      £{item.total}
    </div>
  </div>
  {/each}
</div>
<div class="reciept-totals">
  <div class="item-row">
    <div class="item">
      Total:
    </div>
    <div class="total">
      £{order.total}
    </div>
  </div>
  <div class="item-row">
    <div class="item">
      inc VAT
    </div>
    <div class="total">
      £{order.vat_total}
    </div>
  </div>
</div>

<style>
  .item-row {
    display: flex;
    align-items: center;
    padding: 0.2em;
  }

  .item {
    flex-grow: 1;
  }

  .total {
    width: 20%;
    text-align: right;
  }

</style>