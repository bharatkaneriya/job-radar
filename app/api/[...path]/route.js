// Unknown API paths answer in JSON rather than with the HTML 404 page.
export const dynamic = 'force-dynamic';

const notFound = () => Response.json({ error: 'Not found' }, { status: 404 });

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
