declare module '@banana-dev/banana-dev' {
  const banana: { run(apiKey: string, modelKey: string, input: any): Promise<any> }
  export default banana
}
