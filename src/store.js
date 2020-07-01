import { writable } from 'svelte/store';

export const group = writable(document.body.dataset.group);
export const user = writable(document.body.dataset.user);
export const orderList = writable([]);
orderList.addOrUpdate = function (item) {
  this.update(order => {
    const updatedItem = order.find(orderItem => orderItem.id === item.id);
    if (updatedItem) updatedItem.count = item.count;
    else if (item.count > 0) order.push(item);

    return order.filter(item => item.count > 0);
  });
}
