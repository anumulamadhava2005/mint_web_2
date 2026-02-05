export default async function Projects({params}: {params: {id: string}}) {
    const {id} = await params;
    return <div>Projects Page {id}</div>;
}