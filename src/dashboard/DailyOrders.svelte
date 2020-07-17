<script>
  import { onDestroy } from 'svelte';
  import Review from '../Review.svelte';
  import OrderList from './OrderList.svelte';
  import OrderReview from '../order/OrderReview.svelte';
  import { patch, toData } from '../fetch.js'

  let review = false;
  let sending = false;

  let todaysOrders = refresh();

  const interval = setInterval(refresh, 1000)

  onDestroy(() => {
    clearInterval(interval);
  });

  function editOrder(e) {
    review = e.detail;
  }

  function sendUpdateOrder(flag) {
    sending = true;
    let data = {};
    data[flag] = true;
    patch(`/orders/${review.id}/`, data)
      .then(response => {
        if (response.status === 200) {
          return response.json();
        }
      }).then(updatedOrder => {
        todaysOrders.then(currentOrders => {
          const updatedOrderIndex = currentOrders.findIndex(order => order.id === updatedOrder.id);
          if (updatedOrderIndex >= 0) currentOrders[updatedOrderIndex] = updatedOrder;
          sending = false;
          console.log(currentOrders)
          return currentOrders;
        });
        todaysOrders = todaysOrders;
        review = updatedOrder;
      });
  }

  function refresh() {
    if (!sending) {
      const updatedOrders = fetch('/orders/')
                              .then(toData)
                              .then(data => data.orders)
                              .then(orders => {
        todaysOrders = updatedOrders;
        return orders;
      });
      return updatedOrders;
    }
  }
</script>

<h2>Today's Orders</h2>
<div>
  {#await todaysOrders}
  <p>Loading Orders</p>
  {:then orders}
  <div class="section">
    <h3>Pending</h3>
    <p class="details">These orders haven't been sarted yet</p>
    <OrderList orders="{orders.filter(order => !order.accepted)}" on:editorder={editOrder}/>
  </div>
  <div class="section">
    <h3>Accepted</h3>
    <p class="details">These orders are being worked on</p>
    <OrderList orders="{orders.filter(order => order.accepted && !order.completed)}" on:editorder={editOrder}/>
  </div>
  <div class="section">
    <h3>Completed</h3>
    <p class="details">These orders have been served, but not paid</p>
    <OrderList orders="{orders.filter(order => order.completed && !order.paid)}" on:editorder={editOrder}/>
  </div>
  <div class="section">
    <h3>Paid</h3>
    <p class="details">These orders have been completed and paid</p>
    <OrderList orders="{orders.filter(order => order.completed && order.paid)}" on:editorder={editOrder}/>
  </div>
  {:catch error}
  <p>Oops something went wrong when trying to load today's orders!</p>
  {/await}
</div>

<Review bind:review={review}>
  <div class="inner">
    <div>
      <OrderReview order={review} />
      <div class="buttons">
        {#if !review.accepted}
        <button class="primary md" disabled={sending} on:click="{() => sendUpdateOrder('accepted')}">Accepted</button>
        {:else if !review.completed}
        <button class="primary md" disabled={sending} on:click="{() => sendUpdateOrder('completed')}">Completed</button>
        {/if}
        {#if !review.paid}
        <button class="primary md" disabled={sending} on:click="{() => sendUpdateOrder('paid')}">Paid</button>
        {/if}
      </div>
    </div>
    <div class="back">
      <button class="secondary md" on:click="{() => review = false}">Back to orders</button>
    </div>
  </div>
</Review>

<style>
  .details {
    font-size: 0.8em;
    margin: 0.2em;
  }

  .review {
    height: 70vh;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    transition: height;
    overflow-y: auto;
    background-color: white;
    border-top: 1px solid grey;
    padding-bottom: 0.4em;
  }

  .back {
    display: flex;
    align-items: baseline;
    text-align: center;
  }

  .back button {
    margin: auto;
  }

  .inner {
    height:100%;
    max-width: 600px;
    margin: auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .buttons {
    display: flex;
    justify-content: center;
    margin: 0.2em;
  }

  .buttons button {
    min-width: 30%
  }

  .buttons button:first-child {
    margin-right: 1em;
  }
</style>

