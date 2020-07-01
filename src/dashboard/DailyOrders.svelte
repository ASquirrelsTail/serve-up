<script>
  import { fade, slide } from 'svelte/transition';
  import OrderList from './OrderList.svelte';
  import OrderReview from '../order/OrderReview.svelte';
  import { patch } from '../fetch.js'

  let review = false;
  let sending = false;



  let todaysOrders = fetch('/orders/')
                    .then(response => {
    if (response.status === 200) return response.json();
    else if (response.status === 403) window.location.replace('/admin/login/?next=/dashboard/')})
                    .then(data => data.orders);

  $: {
    if (review) document.body.style = 'overflow: hidden;';
    else document.body.style = '';
  }

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
</script>

<h2>Today's Orders</h2>
<div>
  {#await todaysOrders}
  <p>Loading Orders</p>
  {:then orders}
  <div class="order-list">
    <h3>Pending</h3>
    <p>These orders haven't been sarted yet</p>
    <OrderList orders="{orders.filter(order => !order.accepted)}" on:editorder={editOrder}/>
  </div>
  <div class="order-list">
    <h3>Accepted</h3>
    <p>These orders are being worked on</p>
    <OrderList orders="{orders.filter(order => order.accepted && !order.completed)}" on:editorder={editOrder}/>
  </div>
  <div class="order-list">
    <h3>Completed</h3>
    <p>These orders have been served, but not paid</p>
    <OrderList orders="{orders.filter(order => order.completed && !order.paid)}" on:editorder={editOrder}/>
  </div>
  <div class="order-list">
    <h3>Paid</h3>
    <p>These orders have been completed and paid</p>
    <OrderList orders="{orders.filter(order => order.completed && order.paid)}" on:editorder={editOrder}/>
  </div>
  {:catch error}
  <p>Oops something went wrong when trying to load today's orders!</p>
  {/await}
</div>

{#if review}
<div class="cover" transition:fade on:click="{() => review = false}"></div>
<div class="review" transition:slide>
  <div class="inner">
    <OrderReview order={review} />
    <div class="buttons">
      {#if !review.accepted}
      <button disabled={sending} on:click="{() => sendUpdateOrder('accepted')}">Accepted</button>
      {:else if !review.completed}
      <button disabled={sending} on:click="{() => sendUpdateOrder('completed')}">Completed</button>
      {/if}
      {#if !review.paid}
      <button disabled={sending} on:click="{() => sendUpdateOrder('paid')}">Paid</button>
      {/if}
    </div>
    <button on:click="{() => review = false}">Back to orders</button>
  </div>
  
</div>
{/if}

<style>
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

  .inner {
    max-width: 600px;
    margin: auto;
  }

  .buttons {
    display: flex;
    justify-content: center;
  }

  .buttons button {
    min-width: 30%
  }

  .buttons button:first-child {
    margin-right: 1em;
  }

  .cover {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
  }
</style>

